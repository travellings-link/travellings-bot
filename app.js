//  _____                    _ _ _                     ____ _               _       ____        _   
// |_   _| __ __ ___   _____| | (_)_ __   __ _ ___    / ___| |__   ___  ___| | __  | __ )  ___ | |_ 
//   | || '__/ _` \ \ / / _ \ | | | '_ \ / _` / __|  | |   | '_ \ / _ \/ __| |/ /  |  _ \ / _ \| __|
//   | || | | (_| |\ V /  __/ | | | | | | (_| \__ \  | |___| | | |  __/ (__|   <   | |_) | (_) | |_ 
//   |_||_|  \__,_| \_/ \___|_|_|_|_| |_|\__, |___/   \____|_| |_|\___|\___|_|\_\  |____/ \___/ \__|
//                                       |___/                                                      
//
// By BLxcwg666 <huixcwg@gmail.com>

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const figlet = require('figlet');
// const moment = require('moment');
const dotenv = require('dotenv').config();
const moment = require('moment-timezone');
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { Sequelize, DataTypes } = require('sequelize');

const sql = require('./modules/sqlConfig');
const Web = require('./modules/sqlModel');
const UA = "Mozilla/5.0 (compatible; Travellings Check Bot; +https://www.travellings.cn/docs/qa)";
const tempDir = './tmp';
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

global.version = "1.2";
global.time = function() {
    return moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
}

// 创建 logs（如果没有）
const BotlogsFolderPath = path.join(__dirname, 'logs');
if (!fs.existsSync(BotlogsFolderPath)) {
  fs.mkdirSync(BotlogsFolderPath);
}

// ASCII 艺术字
figlet("Travellings Check Bot", function(err, data) {
    console.log(data);
    console.log(`\nCopyright © 2020－2023 Travellings Project. All rights reserved.（v${global.version}）\n`)
});

console.log(chalk.cyan(`[${global.time()}] [INFO] 尝试连接到数据库...`));
sql
  .authenticate()
  .then(() => {
    console.log(chalk.green(`[${global.time()}] [INFO] 连接到数据库成功 (•̀⌄•́)`));
  })
  .catch((error) => {
    console.log(chalk.red(`[${global.time()}] [ERROR] 连接数据库失败 〒_〒：${error}`));
  });

async function startNewCheck() {
  try {
    await sql.sync().catch(err => console.log(chalk.red(`[${global.time()}] [ERROR]`, err)));  // 数据库同步 + 错误处理

    // 时间
    const currentTimeForFileName = moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH_mm_ss');

    // 写 log
    const logFileName = `${currentTimeForFileName}.log`;
    const logFilePath = path.join(BotlogsFolderPath, logFileName);
    const Botlogstream = fs.createWriteStream(logFilePath, { flags: 'a' });

    const logEntry = `[${global.time()}] >> 开始检测 \n`
    console.log(logEntry);
    Botlogstream.write(`${logEntry}\n`);

    // 查表
    const webs = await Web.findAll();
    let runCount = 0;
    let lostCount = 0;
    let errorCount = 0;
    let timeoutCount = 0;

    const startTime = moment(); // 记录开始时间

    // Headless Browser
    const options = new chrome.Options();
    options.addArguments('--headless'); // headless
    options.addArguments('--disable-gpu'); // 禁用GPU加速
    options.addArguments('--disable-extensions'); // 禁用扩展
    options.addArguments('--disable-dev-shm-usage'); // 禁用/dev/shm
    options.addArguments('--disable-features=StylesWithCss=false'); // 禁用CSS加载
    options.addArguments('--blink-settings=imagesEnabled=false'); // 禁用图片加载
    options.page_load_strategy = 'eager' // DOM解析完后直接操作
    options.addArguments(`--user-data-dir=${path.resolve(tempDir)}`);
    options.addArguments(`--user-agent=${UA}`);
    options.addArguments('--disable-logging');  // 禁用浏览器控制台输出
    options.addArguments('--log-level=3');
    options.addArguments('--no-sandbox');

    const driver = new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    // 超时时间
    await driver.manage()
      .setTimeouts({
        implicit: process.env.BROWSER_TIMEOUT * 1000
      });

    for (const web of webs) {
      let statusReason = ''; // 存储判定原因

      try {
        await driver.get(web.link);

        // 加载页面
        const pageSource = await driver.getPageSource();
        if (pageSource.includes('travellings')) {
          // 有
          await web.update({ status: 'RUN' });
          statusReason = 'RUN';
          runCount++;
        } else {
          // 没有
          await web.update({ status: 'LOST' });
          statusReason = 'LOST';
          lostCount++;
        }
      } catch (error) {
        // 超时
        if (error.name === 'TimeoutError') {
          await web.update({ status: 'TIMEOUT' });
          statusReason = 'TIMEOUT';
          timeoutCount++;
        } else if (error.message.startsWith('4') || error.message.startsWith('5')) {
          // 4xx or 5xx
          await web.update({ status: error.message });
          statusReason = error.message;
        } else {
          await web.update({ status: 'ERROR' });
          statusReason = 'ERROR';
          errorCount++;
        }
      }

      // log
      const logEntry0 = `[${global.time()}] 站点 ${web.link} 检测完成 >> ${statusReason}`;
      console.log(chalk.blue(logEntry0));
      Botlogstream.write(`${logEntry0}\n`);
    }

    await driver.quit();

    // 计算耗时
    const endTime = moment();
    const duration = moment.duration(endTime.diff(startTime));
    const hours = duration.hours();
    const minutes = duration.minutes();
    const seconds = duration.seconds();

    // 输出统计信息
    const logEntry1 = `\n[${global.time()}] >> 共 ${webs.length} 项 | RUN: ${runCount} | LOST: ${lostCount} | ERROR: ${errorCount} | TIMEOUT: ${timeoutCount} \n>> 检测耗时：${hours} 小时 ${minutes} 分钟 ${seconds} 秒\n`
    console.log(logEntry1);
    Botlogstream.write(`${logEntry1}\n`);

    // 关了log
    Botlogstream.end();
  } catch (err) {
    console.log(chalk.red(`[${global.time()}] [ERROR]`, err));
  }
}

// 开机
startNewCheck();

// 每隔 5 小时一次循环，有需要自己改
setInterval(startNewCheck, 5 * 60 * 60 * 1000);
