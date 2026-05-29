import { SettingsNav } from "./SettingsNav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="page-anim">
      <header className="pagehead">
        <div>
          <div className="pagehead__eyebrow">Settings</div>
          <h1 className="pagehead__title">Settings</h1>
        </div>
      </header>

      <div className="settings">
        <SettingsNav />
        <div className="settings__panel">{children}</div>
      </div>
    </div>
  );
}
