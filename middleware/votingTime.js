/**
 * Мидлвар проверки времени голосования
 * Проверка происходит на сервере — клиентское время не учитывается
 */

const { dbGet } = require('../src/utils/dbHelpers');

async function checkVotingTime(req, res, next) {
  try {
    const startSetting = await dbGet("SELECT value FROM settings WHERE key = 'voting_start'");
    const endSetting = await dbGet("SELECT value FROM settings WHERE key = 'voting_end'");

    const startTime = startSetting ? startSetting.value : '18:00';
    const endTime = endSetting ? endSetting.value : '23:59';

    // Получаем текущее московское время
    const now = new Date();
    const mskOffset = 3 * 60; // UTC+3 в минутах
    const mskTime = new Date(now.getTime() + mskOffset * 60 * 1000);

    const currentMinutes = mskTime.getUTCHours() * 60 + mskTime.getUTCMinutes();

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const isOpen = currentMinutes >= startMinutes && currentMinutes < endMinutes;

    req.votingTime = {
      isOpen,
      currentTime: mskTime.toISOString(),
      startTime,
      endTime,
      startMinutes,
      endMinutes,
      currentMinutes
    };

    next();
  } catch (err) {
    console.error('Ошибка проверки времени голосования:', err);
    req.votingTime = { isOpen: false, error: true };
    next();
  }
}

module.exports = { checkVotingTime };