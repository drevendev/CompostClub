import { author } from '../content/author';

export function Author({ language = 'en' }: { language?: 'en' | 'ru' }) {
  return (
    <section
      className="author-block"
      aria-label={language === 'ru' ? 'Об авторе' : 'About the author'}
    >
      <h3>{language === 'ru' ? 'Автор — Dreven' : 'Made by Dreven'}</h3>
      <p>
        {author.publicName} · {language === 'ru' ? 'Соло-разработчик.' : 'Solo developer.'}
      </p>
      <nav
        className="author-links"
        aria-label={language === 'ru' ? 'Ссылки автора' : 'Author links'}
      >
        {author.links.map((link) => (
          <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer">
            {link.label}
          </a>
        ))}
      </nav>
      <p>
        {language === 'ru'
          ? 'Ссылки открываются во внешнем браузере по вашему нажатию.'
          : 'Links open in your browser when selected.'}
      </p>
    </section>
  );
}
