//  _____                    _ _ _                     ____ _               _       ____        _   
// |_   _| __ __ ___   _____| | (_)_ __   __ _ ___    / ___| |__   ___  ___| | __  | __ )  ___ | |_ 
//   | || '__/ _` \ \ / / _ \ | | | '_ \ / _` / __|  | |   | '_ \ / _ \/ __| |/ /  |  _ \ / _ \| __|
//   | || | | (_| |\ V /  __/ | | | | | | (_| \__ \  | |___| | | |  __/ (__|   <   | |_) | (_) | |_ 
//   |_||_|  \__,_| \_/ \___|_|_|_|_| |_|\__, |___/   \____|_| |_|\___|\___|_|\_\  |____/ \___/ \__|
//                                       |___/                                                      
//
// Travellings Check Bot Main
// By BLxcwg666 <huixcwg@gmail.com>
// 2024/01/16 18:10 CST

const chalk = require('chalk');
const cron = require('node-cron');
const moment = require('moment-timezone');
const sql = require('./modules/sqlConfig');
const axiosCheck = require('./methods/axios');
const browserCheck = require('./methods/browser');

global.version = "3.9";
global.time = function() {
    return moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
}

async function checkAll() {
    await console.log(`\n
    _____                    _ _ _                     ____ _               _       ____        _   
   |_   _| __ __ ___   _____| | (_)_ __   __ _ ___    / ___| |__   ___  ___| | __  | __ )  ___ | |_ 
     | || '__/ _\` \\ \\ / / _ \\ | | | '_ \\ / _\` / __|  | |   | '_ \\ / _ \\/ __| |/ /  |  _ \\ / _ \\| __|
     | || | | (_| |\\ V /  __/ | | | | | | (_| \\__ \\  | |___| | | |  __/ (__|   <   | |_) | (_) | |_ 
     |_||_|  \\__,_| \\_/ \\___|_|_|_|_| |_|\\__, |___/   \\____|_| |_|\\___|\\___|_|\\_\\  |____/ \\___/ \\__|
                                         |___/                                                      
    
              Copyright © 2020-2024 Travellings Project. All rights reserved.  //  Version ${global.version}
  `);  
    console.log(chalk.cyan(`[${global.time()}] [INFO] 尝试连接到数据库...`))
    await sql.sync().then(console.log(chalk.green(`[${global.time()}] [OK] 成功连接到数据库~ `))).catch(err => console.log(chalk.red(`[${global.time()}] [ERROR]`, err)));  // 数据库同步 + 错误处理
    await console.log(chalk.green(`[${global.time()}] [APP] [INFO] ✓ 开始巡查站点`));
    await axiosCheck();
    await browserCheck();
    console.log(chalk.green(`[${global.time()}] [APP] [INFO] △ 检测完成，Sleep.`))
}

checkAll();

cron.schedule('0 4 * * *', () => {
    checkAll();
});