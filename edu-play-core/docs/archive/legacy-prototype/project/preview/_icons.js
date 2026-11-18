// Tiny client-side icon hydrator for preview cards.
// Looks for <i data-icon="NAME"></i> nodes and replaces them with inline SVG.
// Avoids any web-font dependency so screenshots render reliably.

(function () {
  const PATHS = {
    home: 'M12 3 3 11h2v9h5v-6h4v6h5v-9h2z',
    auto_awesome: 'm12 2 1.6 4.8L18 8l-4 3.6L15 17l-3-2-3 2 1-5.4L6 8l4.4-1.2z',
    explore: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3.5 6.5L13 13l-4.5 2.5L11 11z',
    bookmark: 'M6 3h12v18l-6-3-6 3z',
    chat_bubble: 'M4 4h16v12H8l-4 4z',
    chat_bubble_outline: 'M4 4h16v12H8l-4 4zm2 2v11.2L7.2 16H18V6z',
    add: 'M19 11h-6V5a1 1 0 0 0-2 0v6H5a1 1 0 0 0 0 2h6v6a1 1 0 0 0 2 0v-6h6a1 1 0 0 0 0-2z',
    qr_code_scanner: 'M3 3h6v2H5v4H3zm12 0h6v6h-2V5h-4zM3 15h2v4h4v2H3zm16 0h2v6h-6v-2h4zM7 7h4v4H7zm6 0h4v4h-4zM7 13h4v4H7zm9 0h-1v3h3v-2h-2z',
    help_outline: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 16a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm1.5-6.3c-.5.4-.7.7-.7 1.3v.5h-1.6v-.6c0-1 .4-1.7 1.1-2.3.7-.5 1-.9 1-1.5 0-.7-.5-1.2-1.3-1.2-.8 0-1.4.5-1.5 1.4H8.8c.1-1.9 1.4-3 3.3-3 1.9 0 3.2 1.1 3.2 2.8 0 1-.5 1.8-1.8 2.6z',
    menu_book: 'M3 5h7v14H3zm11 0h7v14h-7z',
    lightbulb: 'M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2zM9 19h6v1.5a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 20.5z',
    school: 'M12 3 1 9l11 6 9-4.9V17h2V9zm0 11L4 9.6V13l8 4.4 8-4.4V9.6z',
    notifications: 'M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1z',
    build: 'M22 7a4.5 4.5 0 0 1-6 4.2L8.5 18.7a3 3 0 1 1-3.2-3.2L12.8 8A4.5 4.5 0 0 1 18 2l-2.5 2.5L18 7l2.5-2.5z',
    person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.3 0-8 1.7-8 5v3h16v-3c0-3.3-4.7-5-8-5z',
    language: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 17.9A8 8 0 0 1 4.1 13H8c.1 2.4.9 4.7 3 6.9zM4.1 11A8 8 0 0 1 11 4.1c-2 2.2-2.9 4.5-3 6.9zm9-6.9c2 2.2 2.9 4.5 3 6.9h3.9A8 8 0 0 0 13.1 4.1zM13.1 19.9c2-2.2 2.9-4.5 3-6.9H20a8 8 0 0 1-6.9 6.9z',
    logout: 'M10 4h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7v-2h7V6h-7zm-1 4 1.4 1.4L7.8 12H17v2H7.8l2.6 2.6L9 18l-5-5z',
    folder: 'M3 6h7l2 2h9v11H3z',
    favorite: 'M12 21s-7-4.5-9.5-9C.7 8.9 2.5 5 6 5c2.2 0 3.7 1.2 6 3 2.3-1.8 3.8-3 6-3 3.5 0 5.3 3.9 3.5 7-2.5 4.5-9.5 9-9.5 9z',
    mic: 'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm6-3a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.9V22h2v-3.1A8 8 0 0 0 20 11z',
  };
  function hydrate() {
    document.querySelectorAll('i[data-icon]').forEach(el => {
      const name = el.getAttribute('data-icon');
      const path = PATHS[name];
      if (!path) return;
      const size = el.getAttribute('data-size') || 24;
      el.innerHTML =
        `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" style="fill:currentColor;display:inline-block;vertical-align:middle">` +
        `<path d="${path}"/></svg>`;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrate);
  else hydrate();
})();
