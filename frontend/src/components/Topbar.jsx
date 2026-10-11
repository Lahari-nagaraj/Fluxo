import { Bell, Search, Command } from "lucide-react";

export default function Topbar({ activePage }) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>Workspace</span>
        <span className="breadcrumb-separator">/</span>
        <strong>{activePage}</strong>
      </div>

      <div className="topbar-actions">
        <div className="search-box">
          <Search size={17} />
          <span>Search workspace</span>
          <kbd>
            <Command size={11} /> K
          </kbd>
        </div>

        <button
          className="icon-button"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={19} />
        </button>

        <div className="avatar">F</div>
      </div>
    </header>
  );
}
