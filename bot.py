#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Travellings 巡查机器人
检查成员网站的可访问性和开往链接，并自动更新状态
"""

import requests
import time
import re
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse, parse_qs, unquote
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('bot.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 尝试导入 Playwright（可选依赖）
try:
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    logger.warning("Playwright 未安装，将无法检测 JavaScript 跳转和需要渲染的页面。运行 'pip install playwright && playwright install chromium' 来安装。")

# API配置
API_BASE_URL = "https://api.travellings.cn"
API_ALL_URL = f"{API_BASE_URL}/all"
API_EDIT_URL = f"{API_BASE_URL}/action/edit"

# 开往链接域名和GitHub仓库
TRAVELLINGS_DOMAINS = [
    "www.travellings.cn",
    "travellings.cn",
    "travellings.link",
    "github.com/travellings-link/travellings"
]

# 请求超时设置（秒）
REQUEST_TIMEOUT = 30

# 请求头（加强反爬）
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; Travellings Check Bot; +https://www.travellings.cn/docs/qa)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'DNT': '1',
}


class TravellingsBot:
    """Travellings 巡查机器人"""
    
    def __init__(self, cookie: Optional[str] = None, use_browser: bool = True, max_workers: int = 5, 
                 api_delay: float = 2.0, check_delay: float = 0.5):
        """
        初始化机器人
        
        Args:
            cookie: 用于API认证的cookie（_tlogin）
            use_browser: 是否使用浏览器进行深度检查（需要 Playwright），默认 True
            max_workers: 最大并发线程数，默认 5
            api_delay: API请求之间的延迟（秒），用于降低服务器压力，默认 2.0
            check_delay: 检查之间的延迟（秒），用于分散请求，默认 0.5
        """
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        if cookie:
            self.session.cookies.set('_tlogin', cookie)
        self.use_browser = use_browser and PLAYWRIGHT_AVAILABLE
        self.max_workers = max_workers
        self.api_delay = api_delay
        self.check_delay = check_delay
        if self.use_browser:
            logger.info(f"已启用 Chromium 浏览器模式（支持 JavaScript 和动态渲染），并发数: {max_workers}")
        elif use_browser and not PLAYWRIGHT_AVAILABLE:
            logger.warning("Playwright 未安装，将仅使用 requests 模式")
            logger.warning("建议运行 'pip install playwright && playwright install chromium' 来启用浏览器模式")
        if api_delay > 0 or check_delay > 0:
            logger.info(f"已启用请求延迟：API延迟 {api_delay}秒，检查延迟 {check_delay}秒（用于降低服务器压力）")
        self.stats = {
            'total': 0,
            'checked': 0,
            'updated': 0,
            'errors': 0
        }
        # 线程锁，保护共享资源
        self.stats_lock = Lock()
        self.api_lock = Lock()
        # 记录上次API请求时间，用于控制请求频率
        self.last_api_time = 0
    
    def get_all_members(self) -> List[Dict]:
        """
        获取所有成员数据
        
        Returns:
            成员列表
        """
        try:
            logger.info(f"正在从 {API_ALL_URL} 获取成员数据...")
            response = self.session.get(API_ALL_URL, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            data = response.json()
            
            if data.get('success'):
                members = data.get('data', [])
                total = data.get('total', len(members))
                logger.info(f"成功获取 {len(members)} 个成员数据（总计: {total}）")
                self.stats['total'] = len(members)
                return members
            else:
                logger.error(f"API返回失败: {data}")
                return []
        except Exception as e:
            logger.error(f"获取成员数据失败: {e}")
            return []
    
    def check_website_accessible(self, url: str) -> Tuple[bool, Optional[str]]:
        """
        检查网站是否可访问（优先使用 requests，失败时才使用浏览器）
        
        Args:
            url: 网站URL
            
        Returns:
            (是否可访问, 错误信息)
        """
        # 先尝试使用 requests 检查（更快）
        try:
            response = self.session.get(
                url,
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True
            )
            # 2xx和3xx状态码都认为可访问
            if 200 <= response.status_code < 400:
                return True, None
            else:
                # 如果 requests 检查失败，且启用了浏览器模式，再尝试浏览器检查
                if self.use_browser:
                    logger.debug(f"requests 检查返回 {response.status_code}，尝试浏览器检查: {url}")
                    return self._check_website_accessible_with_browser(url)
                return False, f"HTTP {response.status_code}"
        except requests.exceptions.Timeout:
            # 超时情况下，如果启用了浏览器模式，再尝试浏览器检查
            if self.use_browser:
                logger.debug(f"requests 超时，尝试浏览器检查: {url}")
                return self._check_website_accessible_with_browser(url)
            return False, "TIMEOUT"
        except requests.exceptions.ConnectionError:
            # 连接错误，如果启用了浏览器模式，再尝试浏览器检查
            if self.use_browser:
                logger.debug(f"requests 连接错误，尝试浏览器检查: {url}")
                return self._check_website_accessible_with_browser(url)
            return False, "CONNECTION_ERROR"
        except requests.exceptions.RequestException as e:
            # 其他请求异常，如果启用了浏览器模式，再尝试浏览器检查
            if self.use_browser:
                logger.debug(f"requests 请求异常，尝试浏览器检查: {url}")
                return self._check_website_accessible_with_browser(url)
            return False, f"REQUEST_ERROR: {str(e)}"
        except Exception as e:
            return False, f"UNKNOWN_ERROR: {str(e)}"
    
    def _check_website_accessible_with_browser(self, url: str) -> Tuple[bool, Optional[str]]:
        """
        使用浏览器检查网站是否可访问
        
        Args:
            url: 网站URL
            
        Returns:
            (是否可访问, 错误信息)
        """
        if not PLAYWRIGHT_AVAILABLE:
            # 回退到 requests
            try:
                response = self.session.get(
                    url,
                    timeout=REQUEST_TIMEOUT,
                    allow_redirects=True
                )
                if 200 <= response.status_code < 400:
                    return True, None
                else:
                    return False, f"HTTP {response.status_code}"
            except requests.exceptions.Timeout:
                return False, "TIMEOUT"
            except requests.exceptions.ConnectionError:
                return False, "CONNECTION_ERROR"
            except Exception as e:
                return False, f"REQUEST_ERROR: {str(e)}"
        
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    viewport={'width': 1920, 'height': 1080},
                    user_agent=HEADERS['User-Agent']
                )
                page = context.new_page()
                
                try:
                    response = page.goto(url, wait_until='domcontentloaded', timeout=REQUEST_TIMEOUT * 1000)
                    if response and 200 <= response.status < 400:
                        browser.close()
                        return True, None
                    else:
                        browser.close()
                        return False, f"HTTP {response.status if response else 'UNKNOWN'}"
                except PlaywrightTimeoutError:
                    browser.close()
                    return False, "TIMEOUT"
                except Exception as e:
                    browser.close()
                    return False, f"BROWSER_ERROR: {str(e)}"
        except Exception as e:
            return False, f"UNKNOWN_ERROR: {str(e)}"
    
    def check_travellings_link(self, url: str) -> bool:
        """
        检查网站是否包含开往链接（优先使用 requests，失败时才使用浏览器）
        
        Args:
            url: 网站URL
            
        Returns:
            是否包含开往链接
        """
        # 先尝试使用 requests 简单检查（更快）
        has_link = self._check_travellings_link_simple(url)
        if has_link:
            # 如果 requests 检查找到了链接，直接返回，不需要再用浏览器检查
            logger.debug(f"requests 检查已找到开往链接，跳过浏览器检查: {url}")
            return True
        
        # 如果 requests 检查未找到链接，且启用了浏览器模式，再尝试浏览器检查
        if self.use_browser:
            logger.debug(f"requests 检查未找到链接，尝试浏览器检查: {url}")
            return self._check_travellings_link_with_browser(url)
        
        # 未启用浏览器模式，直接返回结果
        return False
    
    def _check_travellings_link_simple(self, url: str) -> bool:
        """
        使用 requests 简单检查开往链接
        
        Args:
            url: 网站URL
            
        Returns:
            是否包含开往链接
        """
        try:
            response = self.session.get(
                url,
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True
            )
            response.raise_for_status()
            
            # 检查响应内容
            content = response.text.lower()  # 转为小写便于匹配
            
            # 方法1: 查找所有链接
            # 匹配 href="..." 或 href='...'
            link_pattern = r'href=["\']([^"\']+)["\']'
            links = re.findall(link_pattern, content, re.IGNORECASE)
            
            # 方法2: 直接在内容中搜索域名和GitHub仓库链接（处理JavaScript动态生成的链接）
            for domain in TRAVELLINGS_DOMAINS:
                if domain in content:
                    logger.debug(f"在 {url} 的内容中找到开往域名: {domain}")
                    return True
            
            # 检查链接
            for link in links:
                # 处理相对链接
                original_link = link
                if link.startswith('//'):
                    link = 'https:' + link
                elif link.startswith('/'):
                    parsed = urlparse(url)
                    link = f"{parsed.scheme}://{parsed.netloc}{link}"
                elif not link.startswith('http'):
                    continue
                
                # 解析域名
                try:
                    parsed_link = urlparse(link)
                    domain = parsed_link.netloc.lower()
                    
                    # 移除www前缀进行比较
                    domain_without_www = domain.replace('www.', '')
                    
                    for travellings_domain in TRAVELLINGS_DOMAINS:
                        # 检查GitHub仓库链接
                        if 'github.com' in travellings_domain:
                            if travellings_domain in link.lower():
                                logger.debug(f"在 {url} 找到开往GitHub仓库链接: {original_link}")
                                return True
                        else:
                            travellings_domain_clean = travellings_domain.replace('www.', '')
                            if domain == travellings_domain or domain_without_www == travellings_domain_clean:
                                logger.debug(f"在 {url} 找到开往链接: {original_link}")
                                return True
                except Exception:
                    continue
            
            return False
        except Exception as e:
            logger.debug(f"简单检查开往链接时出错 {url}: {e}")
            return False
    
    def _check_travellings_link_with_browser(self, url: str) -> bool:
        """
        使用浏览器检查开往链接（支持 JavaScript、中间跳转、动态渲染）
        
        Args:
            url: 网站URL
            
        Returns:
            是否包含开往链接
        """
        if not PLAYWRIGHT_AVAILABLE:
            return False
        
        try:
            with sync_playwright() as p:
                # 启动浏览器（无头模式）
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    viewport={'width': 1920, 'height': 1080},
                    user_agent=HEADERS['User-Agent']
                )
                page = context.new_page()
                
                # 监听所有导航事件，包括中间跳转
                visited_urls = set()
                found_travellings = False
                
                def check_url_for_travellings(check_url: str) -> bool:
                    """检查URL是否包含开往链接"""
                    try:
                        parsed = urlparse(check_url)
                        domain = parsed.netloc.lower().replace('www.', '')
                        path = parsed.path.lower()
                        
                        # 检查域名和完整路径（支持GitHub仓库链接）
                        for travellings_domain in TRAVELLINGS_DOMAINS:
                            # 对于GitHub仓库链接，需要检查完整路径
                            if 'github.com' in travellings_domain:
                                if 'github.com' in domain and path == '/travellings-link/travellings':
                                    logger.debug(f"找到开往GitHub仓库链接: {check_url}")
                                    return True
                                # 也检查完整URL
                                if travellings_domain in check_url.lower():
                                    logger.debug(f"找到开往GitHub仓库链接: {check_url}")
                                    return True
                            else:
                                travellings_domain_clean = travellings_domain.replace('www.', '')
                                if domain == travellings_domain_clean:
                                    logger.debug(f"找到开往链接: {check_url}")
                                    return True
                        
                        # 检查中间跳转页面（如 go.php?url=, redirect.php?url= 等）
                        jump_keywords = ['go.php', 'redirect', 'jump', 'link', 'url', '/go']
                        if any(keyword in check_url.lower() for keyword in jump_keywords):
                            try:
                                query_params = parse_qs(parsed.query)
                                # 检查常见的跳转参数
                                for param_name in ['url', 'link', 'target', 'to', 'goto', 'redirect']:
                                    if param_name in query_params:
                                        redirect_url = query_params[param_name][0]
                                        # URL解码
                                        redirect_url = unquote(redirect_url)
                                        # 检查解码后的URL是否包含开往链接
                                        for travellings_domain in TRAVELLINGS_DOMAINS:
                                            if 'github.com' in travellings_domain:
                                                if travellings_domain in redirect_url.lower():
                                                    logger.debug(f"在中间跳转页面找到开往链接: {redirect_url}")
                                                    return True
                                            else:
                                                parsed_redirect = urlparse(redirect_url)
                                                redirect_domain = parsed_redirect.netloc.lower().replace('www.', '')
                                                travellings_domain_clean = travellings_domain.replace('www.', '')
                                                if redirect_domain == travellings_domain_clean:
                                                    logger.debug(f"在中间跳转页面找到开往链接: {redirect_url}")
                                                    return True
                            except Exception:
                                pass
                        
                        return False
                    except Exception:
                        return False
                
                def handle_response(response):
                    nonlocal found_travellings
                    if found_travellings:
                        return
                    try:
                        response_url = response.url
                        visited_urls.add(response_url)
                        
                        if check_url_for_travellings(response_url):
                            found_travellings = True
                    except Exception:
                        pass
                
                def handle_navigation(navigation):
                    nonlocal found_travellings
                    if found_travellings:
                        return
                    try:
                        nav_url = navigation.url
                        if check_url_for_travellings(nav_url):
                            found_travellings = True
                    except Exception:
                        pass
                
                page.on('response', handle_response)
                page.on('framenavigated', handle_navigation)
                
                # 访问页面
                try:
                    page.goto(url, wait_until='networkidle', timeout=REQUEST_TIMEOUT * 1000)
                except PlaywrightTimeoutError:
                    logger.debug(f"页面加载超时，但继续检查: {url}")
                except Exception as e:
                    logger.debug(f"页面访问出错: {e}")
                    browser.close()
                    return False
                
                # 等待页面渲染
                time.sleep(2)
                
                # 检查页面内容中的链接
                try:
                    # 获取所有链接
                    links = page.query_selector_all('a[href]')
                    for link in links:
                        try:
                            href = link.get_attribute('href')
                            if not href:
                                continue
                            
                            # 处理相对链接
                            if href.startswith('//'):
                                href = 'https:' + href
                            elif href.startswith('/'):
                                parsed = urlparse(url)
                                href = f"{parsed.scheme}://{parsed.netloc}{href}"
                            elif not href.startswith('http'):
                                continue
                            
                            # 检查域名和GitHub仓库链接
                            parsed_link = urlparse(href)
                            domain = parsed_link.netloc.lower().replace('www.', '')
                            path = parsed_link.path.lower()
                            
                            for travellings_domain in TRAVELLINGS_DOMAINS:
                                # 检查GitHub仓库链接
                                if 'github.com' in travellings_domain:
                                    if 'github.com' in domain and path == '/travellings-link/travellings':
                                        logger.debug(f"在页面链接中找到开往GitHub仓库链接: {href}")
                                        found_travellings = True
                                        break
                                    if travellings_domain in href.lower():
                                        logger.debug(f"在页面链接中找到开往GitHub仓库链接: {href}")
                                        found_travellings = True
                                        break
                                else:
                                    travellings_domain_clean = travellings_domain.replace('www.', '')
                                    if domain == travellings_domain_clean:
                                        logger.debug(f"在页面链接中找到开往链接: {href}")
                                        found_travellings = True
                                        break
                            
                            if found_travellings:
                                break
                        except Exception:
                            continue
                except Exception as e:
                    logger.debug(f"获取页面链接时出错: {e}")
                
                # 检查 JavaScript 按钮和事件
                if not found_travellings:
                    try:
                        # 查找所有可能包含跳转的按钮和元素
                        buttons = page.query_selector_all('button, [onclick], [data-url], [data-href]')
                        for button in buttons:
                            try:
                                # 检查 onclick 属性
                                onclick = button.get_attribute('onclick')
                                if onclick:
                                    for domain in TRAVELLINGS_DOMAINS:
                                        if domain in onclick.lower():
                                            logger.debug(f"在按钮 onclick 中找到开往链接: {onclick}")
                                            found_travellings = True
                                            break
                                
                                # 检查 data-url 或 data-href
                                data_url = button.get_attribute('data-url') or button.get_attribute('data-href')
                                if data_url:
                                    parsed_data = urlparse(data_url)
                                    domain = parsed_data.netloc.lower().replace('www.', '')
                                    path = parsed_data.path.lower()
                                    for travellings_domain in TRAVELLINGS_DOMAINS:
                                        if 'github.com' in travellings_domain:
                                            if travellings_domain in data_url.lower():
                                                logger.debug(f"在按钮 data 属性中找到开往GitHub仓库链接: {data_url}")
                                                found_travellings = True
                                                break
                                        else:
                                            travellings_domain_clean = travellings_domain.replace('www.', '')
                                            if domain == travellings_domain_clean:
                                                logger.debug(f"在按钮 data 属性中找到开往链接: {data_url}")
                                                found_travellings = True
                                                break
                                
                                if found_travellings:
                                    break
                            except Exception:
                                continue
                    except Exception as e:
                        logger.debug(f"检查按钮时出错: {e}")
                
                # 检查页面文本内容
                if not found_travellings:
                    try:
                        content = page.content().lower()
                        for domain in TRAVELLINGS_DOMAINS:
                            if domain in content:
                                logger.debug(f"在页面内容中找到开往域名: {domain}")
                                found_travellings = True
                                break
                    except Exception as e:
                        logger.debug(f"检查页面内容时出错: {e}")
                
                # 检查并访问中间跳转页面（如果还没找到）
                if not found_travellings:
                    try:
                        # 查找可能包含跳转参数的链接（如 /go?target=...）
                        links = page.query_selector_all('a[href*="go"], a[href*="redirect"], a[href*="jump"]')
                        for link in links:
                            try:
                                href = link.get_attribute('href')
                                if not href:
                                    continue
                                
                                # 处理相对链接
                                if href.startswith('//'):
                                    href = 'https:' + href
                                elif href.startswith('/'):
                                    parsed_base = urlparse(url)
                                    href = f"{parsed_base.scheme}://{parsed_base.netloc}{href}"
                                elif not href.startswith('http'):
                                    continue
                                
                                # 检查是否包含跳转参数
                                parsed_href = urlparse(href)
                                query_params = parse_qs(parsed_href.query)
                                
                                # 检查跳转参数中是否包含开往链接
                                for param_name in ['url', 'link', 'target', 'to', 'goto', 'redirect']:
                                    if param_name in query_params:
                                        redirect_url = query_params[param_name][0]
                                        redirect_url = unquote(redirect_url)
                                        
                                        # 检查跳转目标是否包含开往链接
                                        for travellings_domain in TRAVELLINGS_DOMAINS:
                                            if 'github.com' in travellings_domain:
                                                if travellings_domain in redirect_url.lower():
                                                    logger.debug(f"在跳转链接参数中找到开往链接: {redirect_url}")
                                                    # 尝试访问跳转页面并跟踪跳转
                                                    try:
                                                        page.goto(href, wait_until='networkidle', timeout=10000)
                                                        time.sleep(1)
                                                        final_url = page.url
                                                        if check_url_for_travellings(final_url):
                                                            logger.debug(f"访问跳转页面后找到开往链接: {final_url}")
                                                            found_travellings = True
                                                            break
                                                    except Exception:
                                                        pass
                                                    if found_travellings:
                                                        break
                                            else:
                                                parsed_redirect = urlparse(redirect_url)
                                                redirect_domain = parsed_redirect.netloc.lower().replace('www.', '')
                                                travellings_domain_clean = travellings_domain.replace('www.', '')
                                                if redirect_domain == travellings_domain_clean:
                                                    logger.debug(f"在跳转链接参数中找到开往链接: {redirect_url}")
                                                    # 尝试访问跳转页面并跟踪跳转
                                                    try:
                                                        page.goto(href, wait_until='networkidle', timeout=10000)
                                                        time.sleep(1)
                                                        final_url = page.url
                                                        if check_url_for_travellings(final_url):
                                                            logger.debug(f"访问跳转页面后找到开往链接: {final_url}")
                                                            found_travellings = True
                                                            break
                                                    except Exception:
                                                        pass
                                                    if found_travellings:
                                                        break
                                        
                                        if found_travellings:
                                            break
                                
                                if found_travellings:
                                    break
                            except Exception:
                                continue
                    except Exception as e:
                        logger.debug(f"检查中间跳转页面时出错: {e}")
                
                # 如果还没找到，尝试点击可能的跳转按钮
                if not found_travellings:
                    try:
                        # 查找包含 "开往"、"travellings" 等关键词的按钮
                        keywords = ['开往', 'travellings', '友链', '链接']
                        for keyword in keywords:
                            try:
                                button = page.query_selector(f'button:has-text("{keyword}"), a:has-text("{keyword}")')
                                if button:
                                    # 点击按钮并等待跳转
                                    with page.expect_navigation(timeout=5000, wait_until='networkidle'):
                                        button.click()
                                    
                                    # 检查当前URL
                                    current_url = page.url
                                    if check_url_for_travellings(current_url):
                                        logger.debug(f"点击按钮后跳转到开往链接: {current_url}")
                                        found_travellings = True
                                        break
                            except Exception:
                                continue
                    except Exception as e:
                        logger.debug(f"尝试点击按钮时出错: {e}")
                
                # 如果还没找到，尝试检查第二层页面（如"更多"页面）
                if not found_travellings:
                    found_travellings = self._check_second_level_page(page, url)
                
                browser.close()
                return found_travellings
                
        except Exception as e:
            logger.debug(f"浏览器检查开往链接时出错 {url}: {e}")
            return False
    
    def _check_second_level_page(self, page, base_url: str) -> bool:
        """
        检查第二层页面（如"更多"页面）是否包含开往链接
        
        Args:
            page: Playwright页面对象
            base_url: 基础URL
            
        Returns:
            是否找到开往链接
        """
        try:
            # 查找可能指向第二层页面的链接（如"更多"、"more"、"links"等）
            second_level_keywords = ['更多', 'more', 'links', '友链', '链接', 'friends', 'friend', 'link']
            
            for keyword in second_level_keywords:
                try:
                    # 查找包含关键词的链接
                    link = page.query_selector(f'a:has-text("{keyword}"), a[href*="{keyword.lower()}"]')
                    if not link:
                        # 也尝试查找href中包含关键词的链接
                        all_links = page.query_selector_all('a[href]')
                        for a_link in all_links:
                            try:
                                href = a_link.get_attribute('href')
                                text = a_link.inner_text().lower() if a_link.inner_text() else ''
                                if keyword.lower() in text or (href and keyword.lower() in href.lower()):
                                    link = a_link
                                    break
                            except Exception:
                                continue
                    
                    if link:
                        try:
                            href = link.get_attribute('href')
                            if not href:
                                continue
                            
                            # 处理相对链接
                            if href.startswith('//'):
                                href = 'https:' + href
                            elif href.startswith('/'):
                                parsed = urlparse(base_url)
                                href = f"{parsed.scheme}://{parsed.netloc}{href}"
                            elif not href.startswith('http'):
                                continue
                            
                            logger.debug(f"尝试访问第二层页面: {href}")
                            
                            # 访问第二层页面
                            page.goto(href, wait_until='networkidle', timeout=REQUEST_TIMEOUT * 1000)
                            time.sleep(2)  # 等待页面渲染
                            
                            # 检查第二层页面内容
                            content = page.content().lower()
                            for travellings_domain in TRAVELLINGS_DOMAINS:
                                if travellings_domain in content:
                                    logger.debug(f"在第二层页面找到开往链接: {href}")
                                    return True
                            
                            # 检查第二层页面的链接
                            second_links = page.query_selector_all('a[href]')
                            for second_link in second_links:
                                try:
                                    second_href = second_link.get_attribute('href')
                                    if not second_href:
                                        continue
                                    
                                    # 处理相对链接
                                    if second_href.startswith('//'):
                                        second_href = 'https:' + second_href
                                    elif second_href.startswith('/'):
                                        parsed_second = urlparse(href)
                                        second_href = f"{parsed_second.scheme}://{parsed_second.netloc}{second_href}"
                                    elif not second_href.startswith('http'):
                                        continue
                                    
                                    # 检查链接
                                    parsed_second_href = urlparse(second_href)
                                    domain = parsed_second_href.netloc.lower().replace('www.', '')
                                    path = parsed_second_href.path.lower()
                                    
                                    for travellings_domain in TRAVELLINGS_DOMAINS:
                                        if 'github.com' in travellings_domain:
                                            if 'github.com' in domain and path == '/travellings-link/travellings':
                                                logger.debug(f"在第二层页面链接中找到开往GitHub仓库链接: {second_href}")
                                                return True
                                            if travellings_domain in second_href.lower():
                                                logger.debug(f"在第二层页面链接中找到开往GitHub仓库链接: {second_href}")
                                                return True
                                        else:
                                            travellings_domain_clean = travellings_domain.replace('www.', '')
                                            if domain == travellings_domain_clean:
                                                logger.debug(f"在第二层页面链接中找到开往链接: {second_href}")
                                                return True
                                except Exception:
                                    continue
                            
                            # 如果找到了，直接返回
                            if any(travellings_domain in page.url.lower() for travellings_domain in TRAVELLINGS_DOMAINS):
                                return True
                            
                        except Exception as e:
                            logger.debug(f"访问第二层页面时出错: {e}")
                            continue
                except Exception:
                    continue
            
            return False
        except Exception as e:
            logger.debug(f"检查第二层页面时出错: {e}")
            return False
    
    def determine_status(self, is_accessible: bool, has_link: bool, error_reason: Optional[str] = None) -> str:
        """
        根据检查结果确定状态
        
        Args:
            is_accessible: 是否可访问
            has_link: 是否有开往链接
            error_reason: 错误原因
            
        Returns:
            状态值
        """
        if not is_accessible:
            # 根据错误原因确定状态
            if error_reason == "TIMEOUT":
                return "TIMEOUT"
            elif "CONNECTION" in error_reason or "HTTP" in error_reason:
                return "ERROR"
            else:
                return "ERROR"
        
        if not has_link:
            # 可访问但没有开往链接
            return "LOST"
        
        # 可访问且有开往链接
        return "RUN"
    
    def update_member_status(self, member: Dict, new_status: str) -> bool:
        """
        更新成员状态（线程安全，带延迟控制）
        
        Args:
            member: 成员数据
            new_status: 新状态
            
        Returns:
            是否更新成功
        """
        # 使用锁保护 API 调用，避免并发冲突
        with self.api_lock:
            # 控制API请求频率，在请求之间添加延迟
            if self.api_delay > 0:
                current_time = time.time()
                time_since_last_api = current_time - self.last_api_time
                if time_since_last_api < self.api_delay:
                    sleep_time = self.api_delay - time_since_last_api
                    logger.debug(f"等待 {sleep_time:.2f} 秒后发送API请求（降低服务器压力）")
                    time.sleep(sleep_time)
            
            try:
                payload = {
                    "id": member["id"],
                    "name": member["name"],
                    "link": member["url"],
                    "tag": member.get("tag", ""),
                    "status": new_status
                }
                
                logger.info(f"更新成员 {member['name']} ({member['url']}) 状态: {member['status']} -> {new_status}")
                
                response = self.session.post(
                    API_EDIT_URL,
                    json=payload,
                    timeout=REQUEST_TIMEOUT
                )
                response.raise_for_status()
                
                # 请求完成后更新最后请求时间
                if self.api_delay > 0:
                    self.last_api_time = time.time()
                
                data = response.json()
                if data.get('success'):
                    logger.info(f"✓ 成功更新 {member['name']} 的状态")
                    with self.stats_lock:
                        self.stats['updated'] += 1
                    return True
                else:
                    logger.error(f"✗ 更新失败: {data.get('msg', '未知错误')}")
                    with self.stats_lock:
                        self.stats['errors'] += 1
                    return False
            except Exception as e:
                # 即使请求失败，也更新最后请求时间，确保延迟机制正常工作
                if self.api_delay > 0:
                    self.last_api_time = time.time()
                logger.error(f"✗ 更新状态时出错 {member['name']}: {e}")
                with self.stats_lock:
                    self.stats['errors'] += 1
                return False
    
    def check_and_update_member(self, member: Dict) -> None:
        """
        检查并更新单个成员
        
        Args:
            member: 成员数据
        """
        member_id = member.get('id')
        member_name = member.get('name', 'Unknown')
        member_url = member.get('url', '')
        current_status = member.get('status', 'UNKNOWN')
        
        logger.info(f"\n检查成员: {member_name} (ID: {member_id})")
        logger.info(f"URL: {member_url}")
        logger.info(f"当前状态: {current_status}")
        
        # 跳过WAIT状态
        if current_status == "WAIT":
            logger.info(f"跳过 WAIT 状态的成员: {member_name}")
            return
        
        # 检查网站可访问性
        is_accessible, error_reason = self.check_website_accessible(member_url)
        logger.info(f"可访问性: {'✓' if is_accessible else '✗'} {error_reason or ''}")
        
        # 检查开往链接
        has_link = False
        if is_accessible:
            has_link = self.check_travellings_link(member_url)
            logger.info(f"开往链接: {'✓' if has_link else '✗'}")
        
        # 确定新状态
        new_status = self.determine_status(is_accessible, has_link, error_reason)
        
        # 决定是否需要更新
        should_update = False
        
        if current_status not in ["RUN", "WAIT"]:
            # 异常状态：如果现在正常，改为RUN
            if new_status == "RUN":
                should_update = True
                logger.info(f"异常状态恢复正常，将更新为 RUN")
        elif current_status == "RUN":
            # RUN状态：如果现在异常，改为对应状态
            if new_status != "RUN":
                should_update = True
                logger.info(f"RUN状态检测到异常，将更新为 {new_status}")
        
        # 执行更新
        if should_update:
            self.update_member_status(member, new_status)
        else:
            logger.info(f"状态无需更新（当前: {current_status}, 检查结果: {new_status}）")
        
        with self.stats_lock:
            self.stats['checked'] += 1
        
        # 在检查完成后添加延迟，将请求分散到整个过程中
        if self.check_delay > 0:
            time.sleep(self.check_delay)
    
    def run(self, limit: Optional[int] = None) -> None:
        """
        运行巡查机器人（多线程模式）
        
        Args:
            limit: 限制检查的成员数量（None表示检查全部）
        """
        logger.info("=" * 60)
        logger.info("Travellings 巡查机器人启动")
        logger.info("=" * 60)
        
        # 获取所有成员
        members = self.get_all_members()
        if not members:
            logger.error("无法获取成员数据，退出")
            return
        
        # 限制检查数量
        if limit:
            members = members[:limit]
            logger.info(f"限制检查数量: {limit}")
        
        # 使用多线程并发检查
        logger.info(f"开始多线程检查，并发数: {self.max_workers}")
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # 提交所有任务
            future_to_member = {
                executor.submit(self.check_and_update_member, member): member
                for member in members
            }
            
            # 处理完成的任务
            completed = 0
            for future in as_completed(future_to_member):
                member = future_to_member[future]
                completed += 1
                try:
                    future.result()  # 获取结果，如果有异常会抛出
                except Exception as e:
                    logger.error(f"处理成员 {member.get('name', 'Unknown')} 时出错: {e}")
                    with self.stats_lock:
                        self.stats['errors'] += 1
                
                # 每完成10个或全部完成时输出进度
                if completed % 10 == 0 or completed == len(members):
                    with self.stats_lock:
                        logger.info(f"进度: {completed}/{len(members)} (已检查: {self.stats['checked']}, 已更新: {self.stats['updated']}, 错误: {self.stats['errors']})")
        
        elapsed_time = time.time() - start_time
        
        # 输出统计信息
        logger.info("\n" + "=" * 60)
        logger.info("巡查完成")
        logger.info("=" * 60)
        logger.info(f"总计: {self.stats['total']}")
        logger.info(f"已检查: {self.stats['checked']}")
        logger.info(f"已更新: {self.stats['updated']}")
        logger.info(f"错误: {self.stats['errors']}")
        logger.info(f"耗时: {elapsed_time:.2f} 秒")
        if self.stats['checked'] > 0:
            logger.info(f"平均每个: {elapsed_time / self.stats['checked']:.2f} 秒")
        logger.info("=" * 60)
        logger.info("脚本执行完毕，正在退出...")
    
    def check_single_website(self, url: str, verbose: bool = True):
        """
        巡查单个网站，输出详细的检查过程和结果（用于分析误报原因）
        
        Args:
            url: 要检查的网站URL
            verbose: 是否输出详细信息
        """
        logger.info("=" * 60)
        logger.info("单个网站巡查模式")
        logger.info("=" * 60)
        logger.info(f"目标URL: {url}")
        logger.info("")
        
        # 1. 检查网站可访问性
        logger.info("【步骤1】检查网站可访问性")
        logger.info("-" * 60)
        
        is_accessible, error_reason = self.check_website_accessible(url)
        
        if verbose:
            logger.info(f"使用的方法: {'浏览器模式' if self.use_browser else '仅 requests'}")
        
        if is_accessible:
            logger.info(f"✓ 网站可访问")
        else:
            logger.info(f"✗ 网站不可访问")
            logger.info(f"错误原因: {error_reason}")
            logger.info("")
            logger.info("=" * 60)
            logger.info("检查完成")
            logger.info("=" * 60)
            logger.info(f"最终结果: 网站不可访问 ({error_reason})")
            logger.info(f"建议状态: {self.determine_status(False, False, error_reason)}")
            return
        
        logger.info("")
        
        # 2. 检查开往链接
        logger.info("【步骤2】检查开往链接")
        logger.info("-" * 60)
        
        if verbose:
            logger.info(f"使用的方法: {'浏览器模式（支持JavaScript）' if self.use_browser else '仅 requests（静态检查）'}")
        
        has_link = self.check_travellings_link(url)
        
        if has_link:
            logger.info(f"✓ 找到开往链接")
        else:
            logger.info(f"✗ 未找到开往链接")
            logger.info("")
            logger.info("可能的原因：")
            logger.info("  1. 网站确实没有添加开往链接")
            logger.info("  2. 链接是通过JavaScript动态加载的（需要浏览器模式）")
            logger.info("  3. 链接在第二层页面（如'更多'、'友链'页面）")
            logger.info("  4. 链接使用了特殊的跳转方式")
            if not self.use_browser:
                logger.info("  5. 当前使用requests模式，无法检测JavaScript渲染的内容")
                logger.info("     建议使用浏览器模式重新检查（移除 --no-browser 参数）")
        
        logger.info("")
        
        # 3. 确定状态
        logger.info("【步骤3】确定状态")
        logger.info("-" * 60)
        
        status = self.determine_status(is_accessible, has_link, error_reason)
        logger.info(f"建议状态: {status}")
        
        logger.info("")
        logger.info("=" * 60)
        logger.info("检查完成")
        logger.info("=" * 60)
        logger.info(f"可访问性: {'✓' if is_accessible else '✗'} {error_reason or ''}")
        logger.info(f"开往链接: {'✓' if has_link else '✗'}")
        logger.info(f"建议状态: {status}")
        logger.info("=" * 60)


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Travellings 巡查机器人')
    parser.add_argument(
        '--cookie',
        type=str,
        help='API认证cookie (_tlogin)',
        default=None
    )
    parser.add_argument(
        '--limit',
        type=int,
        help='限制检查的成员数量（用于测试）',
        default=None
    )
    parser.add_argument(
        '--no-browser',
        action='store_true',
        help='禁用浏览器模式（仅使用 requests）',
        default=False
    )
    parser.add_argument(
        '--workers',
        type=int,
        help='并发线程数（默认: 5）',
        default=5
    )
    parser.add_argument(
        '--api-delay',
        type=float,
        help='API请求之间的延迟（秒），用于降低服务器压力（默认: 2.0）',
        default=2.0
    )
    parser.add_argument(
        '--check-delay',
        type=float,
        help='检查之间的延迟（秒），用于分散请求（默认: 0.5）',
        default=0.5
    )
    parser.add_argument(
        '--check-url',
        type=str,
        help='巡查单个网站（用于分析误报原因），提供要检查的URL',
        default=None
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='输出详细信息（仅用于单个网站检查）',
        default=True
    )
    
    args = parser.parse_args()
    
    # 创建机器人实例
    bot = TravellingsBot(
        cookie=args.cookie,
        use_browser=not args.no_browser,
        max_workers=args.workers,
        api_delay=args.api_delay,
        check_delay=args.check_delay
    )
    
    # 如果指定了单个URL，只检查该网站
    if args.check_url:
        bot.check_single_website(args.check_url, verbose=args.verbose)
    else:
        # 运行巡查
        bot.run(limit=args.limit)


if __name__ == "__main__":
    main()

