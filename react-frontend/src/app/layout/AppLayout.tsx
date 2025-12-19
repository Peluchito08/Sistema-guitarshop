import { useEffect, useRef, useState } from "react";

import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";



import { GlobalSearch } from "../../components/GlobalSearch";

import { appNavItems, type NavItem } from "../../lib/navigation";

import { cn } from "../../lib/utils";



type StoredUser = {

  id_usuario: number;

  nombre_completo?: string;

  correo?: string;

  rol?: string;

};



const navItems = appNavItems;



const readStoredUser = (): StoredUser | null => {

  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem("auth_user");

  if (!raw) return null;

  try {

    return JSON.parse(raw) as StoredUser;

  } catch (error) {

    console.warn("No se pudo parsear auth_user", error);

    return null;

  }

};



export const AppLayout = () => {

  const navigate = useNavigate();

  const [storedUser, setStoredUser] = useState<StoredUser | null>(() => readStoredUser());

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {

    if (typeof window === "undefined") return true;

    return window.localStorage.getItem("sidebar_collapsed") !== "false";

  });



  useEffect(() => {

    if (typeof window === "undefined") return undefined;



    const handleStorage = (event: StorageEvent) => {

      if (event.key === "auth_user") {

        setStoredUser(readStoredUser());

      }

    };



    const handleLocalUpdate = () => {

      setStoredUser(readStoredUser());

    };



    window.addEventListener("storage", handleStorage);

    window.addEventListener("auth_user:updated", handleLocalUpdate);



    return () => {

      window.removeEventListener("storage", handleStorage);

      window.removeEventListener("auth_user:updated", handleLocalUpdate);

    };

  }, []);



  useEffect(() => {

    if (typeof window === "undefined") return;

    window.localStorage.setItem("sidebar_collapsed", String(sidebarCollapsed));

  }, [sidebarCollapsed]);



  // Limpia sesión local y reenvía al login en un solo paso.

  const handleLogout = () => {

    if (typeof window === "undefined") return;

    window.localStorage.removeItem("auth_token");

    window.localStorage.removeItem("auth_user");

    window.dispatchEvent(new Event("auth_user:updated"));

    setStoredUser(null);

    navigate("/login", { replace: true });

  };



  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev);



  const linkBase =

    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors";

  const linkInactive = "text-slate-500 hover:bg-slate-100 hover:text-slate-900";

  const linkActive = "bg-slate-900 text-white shadow-sm";



  return (

    <div className="min-h-screen bg-slate-100 text-slate-900">

      <div

        className="grid min-h-screen"

        style={{ gridTemplateColumns: `${sidebarCollapsed ? "72px" : "220px"} 1fr` }}

      >

        {/* SIDEBAR: navegación fija de toda la aplicación */}

        <aside

          className={cn(

            "flex h-full flex-col border-r border-slate-200 bg-white p-4 transition-[width] duration-300",

            sidebarCollapsed ? "w-[72px] px-2" : "w-[220px]"

          )}

        >

          <div

            className={cn(

              "mb-6 flex items-center gap-2",

              sidebarCollapsed ? "flex-col" : "justify-between"

            )}

          >

            <div

              className={cn(

                "flex items-center gap-2",

                sidebarCollapsed ? "flex-col gap-0 text-center" : ""

              )}

            >

              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">

                GS

              </div>

              {!sidebarCollapsed && (

                <div>

                  <h1 className="text-base font-semibold text-slate-900">GuitarShop</h1>

                  <p className="text-[11px] text-slate-500">Sistema administrativo y ventas</p>

                </div>

              )}

            </div>

            <button

              type="button"

              onClick={toggleSidebar}

              className="rounded-full border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-100"

              aria-label={sidebarCollapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}

            >

              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}

            </button>

          </div>



          <nav className="flex flex-1 flex-col gap-2">

            {navItems.map(({ label, to, icon: Icon }: NavItem) => (

              <NavLink

                key={to}

                to={to}

                className={({ isActive }) =>

                  cn(

                    linkBase,

                    sidebarCollapsed && "justify-center gap-0 px-2 py-2 text-[13px]",

                    isActive ? linkActive : linkInactive

                  )

                }

                end={to === "/dashboard"}

                title={sidebarCollapsed ? label : undefined}

              >

                <Icon className="h-4 w-4" />

                {!sidebarCollapsed && <span>{label}</span>}

              </NavLink>

            ))}

          </nav>

        </aside>



        {/* CONTENIDO */}

        <div className="flex min-h-screen flex-col">

          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">

            <GlobalSearch />

            <UserMenu

              name={storedUser?.nombre_completo}

              email={storedUser?.correo}

              onEditProfile={() => navigate("/perfil")}

              onLogout={handleLogout}

            />

          </header>



          {/* CONTENIDO DE CADA PANTALLA (Outlet de React Router) */}

          <main className="flex-1 overflow-y-auto p-6">

            <Outlet />

          </main>

        </div>

      </div>

    </div>

  );

};



type UserMenuProps = {

  name?: string;

  email?: string;

  onEditProfile: () => void;

  onLogout: () => void;

};



const UserMenu = ({ name, email, onEditProfile, onLogout }: UserMenuProps) => {

  const [open, setOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);



  useEffect(() => {

    if (typeof document === "undefined") return undefined;



    const handleClick = (event: MouseEvent) => {

      if (!menuRef.current) return;

      if (!menuRef.current.contains(event.target as Node)) {

        setOpen(false);

      }

    };



    document.addEventListener("click", handleClick);

    return () => document.removeEventListener("click", handleClick);

  }, []);



  const initials = (name ?? email ?? "GS")

    .split(" ")

    .map((chunk) => chunk[0])

    .join("")

    .slice(0, 2)

    .toUpperCase();



  const menuItems = [

    { label: "Editar perfil", action: () => onEditProfile() },

    { label: "Cerrar sesión", action: () => onLogout(), tone: "danger" as const },

  ];



  return (

    <div className="relative" ref={menuRef}>

      <button

        type="button"

        onClick={() => setOpen((prev) => !prev)}

        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"

        aria-haspopup="menu"

        aria-expanded={open}

      >

        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">

          {initials}

        </span>

        <span className="hidden text-sm text-slate-900 sm:inline">{name ?? "Usuario"}</span>

        <ChevronDown className="h-4 w-4 text-slate-400" />

      </button>

      {open && (

        <div className="absolute right-0 z-10 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg">

          {menuItems.map((item) => (

            <button

              key={item.label}

              onClick={() => {

                setOpen(false);

                item.action();

              }}

              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm ${

                item.tone === "danger"

                  ? "text-red-600 hover:bg-red-50"

                  : "text-slate-600 hover:bg-slate-100"

              }`}

            >

              {item.label}

            </button>

          ))}

        </div>

      )}

    </div>

  );

};