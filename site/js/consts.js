export const KINDS = {
  sto: { title: 'СТО / Автосервис', short: 'СТО', icon: '🔧', desc: 'Ремонт, диагностика, ТО' },
  tow: { title: 'Эвакуатор', short: 'Эвакуатор', icon: '🚛', desc: 'Приедет за 30–60 минут' },
  wash: { title: 'Автомойка', short: 'Мойка', icon: '🧽', desc: 'Запись на удобное время' },
  parts: { title: 'Запчасти', short: 'Запчасти', icon: '⚙️', desc: 'Магазины и авторазборки' },
  urgent: { title: 'Выездная помощь', short: 'Выезд', icon: '🆘', desc: 'Замки, шины, электрик, перегон' },
};
export const URGENT = {
  locksmith: '🔓 Вскрытие замков', tire: '🛞 Выездной шиномонтаж', electrician: '⚡ Выездной электрик',
  mechanic: '🔧 Мастер-универсал', delivery: '🚗 Перегон / доставка',
};
export const SUPPLIER = { shop: '🏪 Автомагазины (новые)', razborka: '🔧 Авторазборки (б/у)' };
export const TOW_VEHICLES = ['Легковой автомобиль', 'Внедорожник / Кроссовер', 'Мотоцикл', 'Спецтехника / Микроавтобус'];
export const WHEELS = ['Колёса крутятся', 'Колёса заблокированы', 'Не знаю'];
export const WASH_SERVICES = ['Быстрая мойка (кузов)', 'Комплексная мойка', 'Мойка двигателя', 'Химчистка салона', 'Детейлинг / полировка'];
export const CAR_TYPES = ['Седан', 'Хэтчбек', 'Внедорожник', 'Минивэн', 'Фургон'];
export const PARTS_URGENCY = ['Нужно сегодня', 'В течение недели', 'Просто узнать цену'];
export const PARTS_ORIG = ['Оригинал', 'Аналог', 'Неважно'];
export const PARTS_DELIVERY = ['Заберу сам', 'Нужна доставка'];
export const STATUS = {
  new: ['Ищем исполнителя', 'blue'], offers: ['Есть предложения', 'gold'], active: ['В работе', 'gold'],
  price_offered: ['Мойка предложила цену', 'gold'], client_approved: ['Запись подтверждена', 'green'],
  in_progress: ['Моют', 'gold'], waiting_client: ['Готово, ждём вас', 'green'], delivered: ['Передано, подтвердите', 'gold'],
  completed: ['Выполнено', 'green'], cancelled: ['Отменено', 'grey'], expired: ['Время вышло', 'grey'],
  pending: ['На рассмотрении', 'gold'], approved: ['Одобрено', 'green'], rejected: ['Отклонено', 'red'],
};
export const effStatus = (r) => (['new', 'offers'].includes(r.status) && r.expires_at && new Date(r.expires_at) < new Date()) ? 'expired' : r.status;
