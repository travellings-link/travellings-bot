//   _   _                           _   _   _ _   _ _
//  | | | |_ __ ___   __ _ _ __ ___ (_) | | | | |_(_) |___
//  | | | | '_ ` _ \ / _` | '_ ` _ \| | | | | | __| | / __|
//  | |_| | | | | | | (_| | | | | | | | | |_| | |_| | \__ \
//   \___/|_| |_| |_|\__,_|_| |_| |_|_|  \___/ \__|_|_|___/
//
// By BLxcwg666 <huixcwg@gmail.com>
// Suggested By linlinzzo

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');
const cron = require('node-cron');
const dotenv = require('dotenv').config();

const filePath = path.join('./data', 'token.json');
if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data');
}

function auth(user, passwd) {
    axios.post(process.env.UMAMI_API + '/auth/login', {
        "username": user,
        "password": passwd
    }).then(function (response) {
        const tokenData = { token: response.data.token };
        fs.writeFile(filePath, JSON.stringify(tokenData), (e) => {
            if (e) {
                console.error(chalk.red(`[${global.time()}] [TBOT] [ERROR]`, e));
            } else {
                console.log(chalk.green(`[${global.time()}] [UMAMI] [OK]`, '获取 Token 成功'));
            }
        });
    }).catch(function (error) {
        return console.log(chalk.red(`[${global.time()}] [UMAMI] [ERROR]`, '请求失败：', error))
    });
}

function verify(token) {
    axios.get(process.env.UMAMI_API + '/auth/verify', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    }).catch(function (error) {
        console.log(chalk.yellow(`[${global.time()}] [UMAMI] [WARNING]`, '身份过期，正在尝试重新登录：', error))
        auth(process.env.UMAMI_USERNAME, process.env.UMAMI_PASSWORD);
    });
}

function readToken(callback) {
    fs.readFile(filePath, 'utf8', (e, data) => {
        if (e) {
            console.log(chalk.red(`[${global.time()}] [UMAMI] [ERROR]`, '读取 Token 失败：', e));
            callback(e, null); // 传递错误给回调函数
            return;
        }
        const tokenData = JSON.parse(data);
        const token = tokenData.token;
        callback(null, token); // 传递 token 给回调函数
    });
}

module.exports = { auth, verify, readToken }