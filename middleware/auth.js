/**
 * Мидлвар авторизации администратора
 * Проверяет наличие сессии администратора
 */

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }

  // Если запрос API — возвращаем JSON
  if (req.path.startsWith('/api/admin')) {
    return res.status(401).json({ error: 'Требуется авторизация администратора' });
  }

  // Для страниц — редирект на вход
  res.redirect('/admin/login');
}

module.exports = { requireAdmin };