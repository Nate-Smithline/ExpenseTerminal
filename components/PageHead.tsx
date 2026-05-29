// PageHead — appears at top of every app page
// Matches the design spec: eyebrow + 32px title + sub + right slot

interface PageHeadProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}

export function PageHead({ eyebrow, title, sub, right }: PageHeadProps) {
  return (
    <header className="pagehead">
      <div>
        {eyebrow && <div className="pagehead__eyebrow">{eyebrow}</div>}
        <h1 className="pagehead__title">{title}</h1>
        {sub && <div className="pagehead__sub">{sub}</div>}
      </div>
      {right && <div className="pagehead__right">{right}</div>}
    </header>
  );
}
