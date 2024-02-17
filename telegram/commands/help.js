module.exports = (bot) => {
    bot.command('help', (ctx) => ctx.reply(`
<strong>帮助菜单</strong>\n
<strong>路人</strong>
/start - 开始
/help - 帮助
/query :ID - 查询站点\n
<strong>管理</strong>
/check :ID :Method
`, { parse_mode: 'HTML' }));
};