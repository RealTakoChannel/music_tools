export const toolIds = ['home', 'audiojoin', 'bpmcalc', 'cashier'];

export function readToolRoute({ hash = '', search = '' }) {
  const route = hash.replace(/^#\/?/, '').replace(/\/$/, '');
  if (toolIds.includes(route)) return route;
  if (!hash && new URLSearchParams(search).get('desktop') === '1') return 'audiojoin';
  return 'home';
}

export function toolHref(tool) {
  return `#/${toolIds.includes(tool) ? tool : 'home'}`;
}
