import {
  LayoutDashboard,
  Package,
  Truck,
  MapPinned,
  Activity,
  Settings,
  Zap,
} from "lucide-react";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Orders", icon: Package },
  { label: "Drivers", icon: Truck },
  { label: "Live Tracking", icon: MapPinned },
];

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <Zap size={23} />
        </div>
        <div>
          <h2>fluxo</h2>
          <span>DELIVERY SYSTEMS</span>
        </div>
      </div>

      <p className="nav-heading">WORKSPACE</p>

      <nav className="navigation">
        {navigation.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className={`nav-item ${activePage === label ? "active" : ""}`}
            onClick={() => onNavigate(label)}
          >
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="system-status">
          <span className="status-dot" />
          <div>
            <strong>System workspace</strong>
            <small>Local environment</small>
          </div>
        </div>

        <button
          className={`nav-item ${activePage === "System" ? "active" : ""}`}
          onClick={() => onNavigate("System")}
        >
          <Settings size={19} />
          <span>System</span>
        </button>

        <div className="sidebar-footer">FLUXO · DISTRIBUTED LOGISTICS</div>
      </div>
    </aside>
  );
}
