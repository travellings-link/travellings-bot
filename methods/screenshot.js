// const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const logger = require('../modules/logger');
const { webModel } = require('../modules/sqlModel');

// 如果不存在 tmp 就创建一个
const tmpPath = process.env.TMP_PATH;
if (!fs.existsSync(tmpPath)) {
    fs.mkdirSync(tmpPath);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function screenshotByID(id) {
    try {
        const web = await webModel.findByPk(id);

        if (!web) {
            throw new Error('没找到喵~ 你确定你输入的 ID 正确吗？');
        }

        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                `--user-data-dir=${path.resolve(tmpPath)}`,
                '--user-agent=Mozilla/5.0 (compatible; Travellings Check Bot; +https://www.travellings.cn/docs/qa)',
                '--disable-logging',
                '--log-level=3',
                '--no-sandbox'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setExtraHTTPHeaders({
            referer: 'https://www.travellings.cn/go.html' // 来自开往的 Referer
        });
        // await page.setDefaultNavigationTimeout(process.env.LOAD_TIMEOUT * 1000);

        await page.goto(web.link);
        await sleep(4500);
        const screenshotBuffer = await page.screenshot();

        await browser.close();
        return screenshotBuffer;
    } catch (e) {
        logger.err(e, "SCREENSHOT")
        throw new Error('出错了喵~ 更多信息可能包含在控制台中~');
    }
}

async function screenshotByUrl(url) {
    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                `--user-data-dir=${path.resolve(tmpPath)}`,
                '--user-agent=Mozilla/5.0 (compatible; Travellings Check Bot; +https://www.travellings.cn/docs/qa)',
                '--disable-logging',
                '--log-level=3',
                '--no-sandbox'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setExtraHTTPHeaders({
            referer: 'https://www.travellings.cn/go.html' // 来自开往的 Referer
        });
        // await page.setDefaultNavigationTimeout(process.env.LOAD_TIMEOUT * 1000);

        await page.goto(url);
        await sleep(4500);
        const screenshotBuffer = await page.screenshot();

        await browser.close();
        return screenshotBuffer;
    } catch (e) {
        logger.err(e, "SCREENSHOT")
        throw new Error('出错了喵~ 更多信息可能包含在控制台中~');
    }
}

module.exports = { screenshotByID, screenshotByUrl };