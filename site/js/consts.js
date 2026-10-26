export const KINDS = {
  sto: { title: 'СТО / Автосервис', short: 'СТО', icon: '🔧', desc: 'Ремонт, диагностика, ТО' },
  tow: { title: 'Эвакуатор', short: 'Эвакуатор', icon: '🚛', desc: 'Приедет за 30–60 минут' },
  wash: { title: 'Автомойка', short: 'Мойка', icon: '🧽', desc: 'Запись на удобное время' },
  parts: { title: 'Запчасти', short: 'Запчасти', icon: '⚙️', desc: 'Магазины и авторазборки' },
  urgent: { title: 'Выездная помощь', short: 'Выезд', icon: '🆘', desc: 'Замки, шины, электрик, перегон' },
  cargo: { title: 'Грузоперевозки', short: 'Грузы', icon: '🚚', desc: 'Газели и грузовики до 3 т, грузчики' },
};
// Кто такой исполнитель на визитке (подпись под названием)
export const CARD_ROLE = { sto: 'Автосервис', tow: 'Эвакуатор', wash: 'Автомойка', parts: 'Магазин запчастей', urgent: 'Выездная помощь', cargo: 'Грузоперевозки' };

// ---------- грузоперевозки (перенесено из ВЕЗУ, dogruz/js/common.js) ----------
export const CARGO_SERVICES = ['Переезд', 'Мебель', 'Стройматериалы', 'Вывоз мусора', 'Бытовая техника', 'Межгород', 'Мелкий груз', 'Грузчики'];
export const CARGO_VEHICLES = [
  { id: 'kabluk', name: 'Каблук', cap: 'до 0,5 т', img: 'assets/img/cargo/v-kabluk.webp', hour: 4000 },
  { id: 'gazel', name: 'Газель', cap: 'до 1,5 т', img: 'assets/img/cargo/v-gazel.webp', hour: 6000 },
  { id: 'gazel_long', name: 'Газель удлинённая', cap: 'до 2 т', img: 'assets/img/cargo/v-gazel-long.webp', hour: 7500 },
  { id: 'truck3', name: 'Грузовик', cap: 'до 3 т', img: 'assets/img/cargo/v-truck3.webp', hour: 9000 },
];
export const CARGO_WHEN = ['Сейчас', 'Сегодня', 'Завтра', 'На этой неделе', 'Договоримся'];
export const CARGO_EXTRAS = ['Грузчики', 'Тент', 'Ремни', 'Сборка/разборка мебели'];
export const CARGO_IMG = { 'Переезд': 'assets/img/cargo/s-move.webp', 'Мебель': 'assets/img/cargo/s-furniture.webp', 'Стройматериалы': 'assets/img/cargo/s-build.webp', 'Вывоз мусора': 'assets/img/cargo/s-trash.webp' };
// Статусы WhatsApp-заявок и заказов (кабинет владельца)
export const LEAD_STATUS = { new: ['Новая', 'blue'], clarify: ['Уточнение', 'blue'], agreed: ['Цена согласована', 'gold'], in_work: ['В работе', 'gold'], done: ['Выполнена', 'green'],
  paid: ['Оплачена', 'green'], closed: ['Закрыта', 'grey'], cancelled: ['Отменена', 'grey'] };
// Шаги заказа для шкалы в чате (оценка — отдельный флаг rating)
export const ORDER_STEPS = [['new', 'Новая'], ['clarify', 'Уточнение'], ['agreed', 'Цена согласована'], ['in_work', 'В работе'], ['done', 'Выполнено'], ['paid', 'Оплачено'], ['rated', 'Оценено'], ['closed', 'Закрыт']];
export const CHAT_PURGE_DAYS = 3;
export const SHOP_DELIVERY = ['Самовывоз', 'Курьер по городу', 'Доставка по Казахстану'];
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
  completed: ['Выполнено', 'green'], in_work: ['В работе', 'gold'], done: ['Выполнено', 'green'], cancelled: ['Отменено', 'grey'], expired: ['Время вышло', 'grey'],
  pending: ['На рассмотрении', 'gold'], approved: ['Одобрено', 'green'], rejected: ['Отклонено', 'red'],
};
export const effStatus = (r) => (['new', 'offers'].includes(r.status) && r.expires_at && new Date(r.expires_at) < new Date()) ? 'expired' : r.status;
