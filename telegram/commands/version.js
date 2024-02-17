module.exports = (bot) => {
    bot.command('version', (ctx) => ctx.reply(`
<strong>Travellings Bot</strong>
Version：${global.version}
https://github.com/travellings-link/travellings-bot
`, { disable_web_page_preview: true, parse_mode: 'HTML' }));
};