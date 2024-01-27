//   ____ _                                 ____      _   
//  / ___| |__  _ __ ___  _ __ ___   ___   / ___| ___| |_ 
// | |   | '_ \| '__/ _ \| '_ ` _ \ / _ \ | |  _ / _ \ __|
// | |___| | | | | | (_) | | | | | |  __/ | |_| |  __/ |_ 
//  \____|_| |_|_|  \___/|_| |_| |_|\___|  \____|\___|\__|
//
// Chrome Webdriver Check Websites util
// By <huixcwg@gmail.com>
// 2024/01/16 13:39 CST

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const chrome = require('selenium-webdriver/chrome');
const { webModel } = require('../modules/sqlModel');
const { sendMessage } = require('../modules/telegramBot');
const { Builder } = require('selenium-webdriver');

var total = 0, run = 0, lost = 0, errorCount = 0, timeout = 0, fourxx = 0, fivexx = 0;

// 如果不存在 logs 则创建一个
const logPath = process.env.LOG_PATH;
if (!fs.existsSync(logPath)) {
  fs.mkdirSync(logPath);
}

// 如果不存在 tmp 就创建一个
const tmpPath = process.env.TMP_PATH;
if (!fs.existsSync(tmpPath)) {
    fs.mkdirSync(tmpPath);
}

function initBrowser() {
    const options = new chrome.Options();
    options.addArguments('--headless'); // headless
    options.addArguments('--disable-features=StylesWithCss=false'); // 禁用CSS加载
    options.addArguments('--blink-settings=imagesEnabled=false'); // 禁用图片加载
    options.addArguments(`--user-data-dir=${path.resolve(tmpPath)}`);
    options.addArguments(`--user-agent=Mozilla/5.0 (compatible; Travellings Check Bot; +https://www.travellings.cn/docs/qa)`);
    options.addArguments('--disable-logging');  // 禁用浏览器控制台输出
    options.addArguments('--log-level=3');
    options.addArguments('--no-sandbox');

    const driver = new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

    return driver;
}

function spentTime(input) {
    const hours = Math.floor(input / 3600);
    const minutes = Math.floor((input % 3600) / 60);
    const seconds = Math.floor(input % 60);
    return `${hours}小时 ${minutes}分 ${seconds}秒`;
}

async function browserCheck(input) {
    const driver = initBrowser();
    const startTime = new Date();
    const logStream = fs.createWriteStream(path.join(logPath, `${moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH-mm-ss')}_Browser.log`), { flags: 'a' });
  try {
    if (!input) {
      // 没传参不动
      const sitesToCheck = await webModel.findAll({
        where: {
          status: {
            [Op.in]: ['LOST', 'ERROR']
          }
        },
      });

      for (const site of sitesToCheck) {
        await check(driver, site, logStream);
    }
    } else {
      const site = await webModel.findOne({
        where: {
          id: input,
        },
      });

      if (site) {
        await check(driver, site, logStream);
      } else {
        console.log(chalk.red(`[${global.time()}] [BROWSER] [ERROR] 指定的 ID 不存在`));
        logStream.write(`\n[${global.time()}] [BROWSER] [ERROR] 指定的 ID 不存在`);
        return 1;
      }
    }
  } catch (error) {
    console.log(chalk.red(`[${global.time()}] [BROWSER] [ERROR] 发生错误：${error}`));
    logStream.write(`\n[${global.time()}] [BROWSER] [ERROR] 发生错误：${error}`);
  } finally {
    await driver.quit();
    const endTime = new Date();
    const input = (endTime - startTime) / 1000;
    const stats = `检测耗时：${spentTime(input)}｜总共: ${total} 个｜RUN: ${run} 个｜LOST: ${lost} 个｜4XX: ${fourxx} 个｜5XX: ${fivexx} 个｜ERROR: ${errorCount} 个｜TIMEOUT: ${timeout} 个`;
    console.log(chalk.cyan(`[${global.time()}] [BROWSER] [INFO] 检测完成 >> ${stats}`));
    logStream.write(`\n[${global.time()}] [BROWSER] [INFO] 检测完成 >> ${stats}`);
    logStream.close();
    sendMessage(`<strong>开往巡查姬提醒您：</strong>\n\n本次巡查方式：Browser\n持续了 ${spentTime(input)}\n\n<strong>巡查报告</strong>\n总共: ${total} 个｜RUN: ${run} 个｜LOST: ${lost} 个｜4XX: ${fourxx} 个｜5XX: ${fivexx} 个｜ERROR: ${errorCount} 个｜TIMEOUT: ${timeout} 个\n\n发送时间：${global.time()} CST\n备注：仅巡查 LOST 和 ERROR 状态的站点`);
  }
}

async function check(driver, site, logStream) {
  try {
    await driver.manage().setTimeouts({ pageLoad: process.env.LOAD_TIMEOUT * 1000 });
    await driver.get(site.link);
    total++;

    if (site.status.toString() >= 500) {
      console.log(chalk.blue(`[${global.time()}] [BROWSER] [INFO] ID >> ${site.id}, Result >> 不做修改`));
      logStream.write(`\n[${global.time()}] [BROWSER] [INFO] ID >> ${site.id}, Result >> 不做修改`);
      fourxx++;
    } else {
        // await driver.wait(until.alertIsPresent(), 1500);

        // await driver.switchTo().alert().then(async (alert) => {
        //   await alert.dismiss(); // 忽略alert
        // });

      const pageSource = await driver.getPageSource();
      const include = pageSource.includes('travelling');

      if (include) {
        await webModel.update({ status: 'RUN', failedReason: null }, { where: { id: site.id } });
        console.log(chalk.blue(`[${global.time()}] [BROWSER] [INFO] ID >> ${site.id}, Result >> ${site.status} → RUN`));
        logStream.write(`\n[${global.time()}] [BROWSER] [INFO] ID >> ${site.id}, Result >> ${site.status} → RUN`);
        run++;
      } else {
        await webModel.update({ status: 'LOST', failedReason: null }, { where: { id: site.id } });
        console.log(chalk.blue(`[${global.time()}] [BROWSER] [INFO] ID >> ${site.id}, Result >> ${site.status} → LOST`));
        logStream.write(`\n[${global.time()}] [BROWSER] [INFO] ID >> ${site.id}, Result >> ${site.status} → LOST`)
        lost++;
      }
    }
  } catch (error) {
    console.log(chalk.blue(`[${global.time()}] [BROWSER] [INFO] ID >> ${site.id}, Result >> 不做修改, Reason >> ${error.message}`));
    logStream.write(`\n[${global.time()}] [BROWSER] [INFO] ID >> ${site.id}, Result >> 不做修改, Reason >> ${error.message}`);
    errorCount++;
  }
}

module.exports = browserCheck;