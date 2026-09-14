import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "./auth/useAuth.ts";
import { useTheme } from "./components/ThemeProvider.tsx";
import Login from "./pages/Login.tsx";
import {
  Moon,
  Sun,
  LogOut,
  FileText,
  Layers,
  Users,
  ArrowLeftRight,
  Boxes,
  FolderTree,
  Tags,
  Database,
  BookOpen,
  Key,
  User
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  usecases: FileText,
  subusecases: Layers,
  roles: Users,
  transactions: ArrowLeftRight,
  classes: Boxes,
  propertygroups: FolderTree,
  properties: Tags,
  ontology: Database,
  standards: BookOpen,
  users: User,
  "api-keys": Key,
};

function NavItem({ to, label, icon }: { to: string; label: string; icon?: string}) {
  const Icon = icon ? iconMap[icon] : null;

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `nav-link ${isActive ? "nav-link-active" : "nav-link-inactive"}`
      }
    >
      {Icon && <Icon size={16} />}
      <span>{label}</span>
    </NavLink>
  );
}

function AppContent() {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <nav className="app-sidebar custom-scrollbar">
        {/* Logo / Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Database className="text-white" size={22} />
          </div>
          <div>
            <div className="sidebar-brand-name">Knowledge Hub</div>
            <div className="sidebar-brand-sub">BUW - DPBB</div>
          </div>
        </div>

        {/* User*/}
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <div className="sidebar-avatar">
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-username">{user?.username}</div>
              <div className="sidebar-role">
                                <span
                                  className="sidebar-role-dot"
                                  style={{ background: user?.role === "write" ? "var(--green-500)" : "var(--blue-500)"}}
                                />
                {user?.role === "write" ? "Schreiben" : "Lesen"}
              </div>
            </div>
          </div>
          <div className="sidebar-actions">
            <button onClick={toggleTheme} className="theme-toggle" title="Theme wechseln" style={{width:"70px"}}>
              {theme === "dark" ? <><Sun size={14} /> Hell</> : <><Moon size={14} /> Dunkel</>}
            </button>
            <button onClick={logout} className="btn btn-danger btn-sm" style={{ flex: 1 }}>
              <LogOut size={13} /> Logout
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="nav-section">Navigation</div>
        <NavItem to="/usecases" label="Use Cases" icon="usecases" />
        <NavItem to="/subusecases" label="Sub Use Cases" icon="subusecases" />
        <NavItem to="/roles" label="Rollen" icon="roles" />
        <NavItem to="/transactions" label="Transaktionen" icon="transactions" />
        <NavItem to="/classes" label="Klassen" icon="classes" />
        <NavItem to="/propertygroups" label="Merkmalsgruppen" icon="propertygroups" />
        <NavItem to="/properties" label="Merkmale" icon="properties" />
        <NavItem to="/ontology" label="Ontologie" icon="ontology" />
        <NavItem to="/standards" label="Standards" icon="standards" />

        <div className="nav-separator" />

        <div className="nav-section">Verwaltung</div>
        <NavItem to="/users" label="Benutzer" icon="users" />
        <NavItem to="/api-keys" label="API-Keys" icon="api-keys" />
      </nav>

      {/* Main */}
      <main className="app-main">
        <div className="app-main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AppContent;