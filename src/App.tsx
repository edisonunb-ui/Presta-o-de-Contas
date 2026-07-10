import React, { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc } from "firebase/firestore";
import { db } from "./firebase";
import { seedDatabaseIfEmpty } from "./utils/seed";
import { User, Administradora, Condominium, Folder, FileEntry, Protocol, Message, AuditLog } from "./types";
import AdminPanel from "./components/AdminPanel";
import FoldersTab from "./components/FoldersTab";
import ProtocolsTab from "./components/ProtocolsTab";
import AuditTab from "./components/AuditTab";
import {
  Building2,
  Lock,
  User as UserIcon,
  LogOut,
  ChevronRight,
  FolderKanban,
  HelpCircle,
  ShieldCheck,
  Building,
  Menu,
  X,
  PlusCircle,
  FileCheck2,
  Users
} from "lucide-react";

export default function App() {
  // Authentication & session
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("portal_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // DB States
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [administradoras, setAdministradoras] = useState<Administradora[]>([]);
  const [condominios, setCondominios] = useState<Condominium[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Selection states
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"folders" | "protocols" | "admin" | "audit">("folders");

  // UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(true);

  // 1. Seed database and subscribe to collections on mount
  useEffect(() => {
    const runSeedAndSub = async () => {
      try {
        await seedDatabaseIfEmpty();
      } catch (err) {
        console.error("Seeding error:", err);
      } finally {
        setIsSeeding(false);
      }
    };
    runSeedAndSub();

    // Set up real-time listeners for all Firestore collections
    const unsubUsers = onSnapshot(collection(db, "usuarios"), (snapshot) => {
      const list: User[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as User);
      });
      setUsuarios(list);
    });

    const unsubAdms = onSnapshot(collection(db, "administradoras"), (snapshot) => {
      const list: Administradora[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Administradora);
      });
      setAdministradoras(list);
    });

    const unsubCondos = onSnapshot(collection(db, "condominios"), (snapshot) => {
      const list: Condominium[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Condominium);
      });
      setCondominios(list);
    });

    const unsubPastas = onSnapshot(collection(db, "pastas"), (snapshot) => {
      const list: Folder[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Folder);
      });
      setFolders(list);
    });

    const unsubArquivos = onSnapshot(collection(db, "arquivos"), (snapshot) => {
      const list: FileEntry[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as FileEntry);
      });
      setFiles(list);
    });

    const unsubProtos = onSnapshot(collection(db, "protocolos"), (snapshot) => {
      const list: Protocol[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Protocol);
      });
      setProtocols(list);
    });

    const unsubMsgs = onSnapshot(collection(db, "mensagens"), (snapshot) => {
      const list: Message[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Message);
      });
      setMessages(list);
    });

    const unsubAudit = onSnapshot(collection(db, "auditoria"), (snapshot) => {
      const list: AuditLog[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as AuditLog);
      });
      setAuditLogs(list);
    });

    return () => {
      unsubUsers();
      unsubAdms();
      unsubCondos();
      unsubPastas();
      unsubArquivos();
      unsubProtos();
      unsubMsgs();
      unsubAudit();
    };
  }, []);

  // Update localStorage session if currentUser state changes
  useEffect(() => {
    if (currentUser) {
      // Find latest user data from the loaded user list (useful for live permission/role edits)
      const freshUser = usuarios.find((u) => u.id === currentUser.id);
      if (freshUser) {
        localStorage.setItem("portal_user", JSON.stringify(freshUser));
        setCurrentUser(freshUser);
      }
    }
  }, [usuarios]);

  // Audit logger helper
  const addAuditLog = async (action: string, details: string) => {
    if (!currentUser) return;
    try {
      await addDoc(collection(db, "auditoria"), {
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action,
        details,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error writing audit log:", error);
    }
  };

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    const matchedUser = usuarios.find(
      (u) => u.email.toLowerCase() === loginEmail.trim().toLowerCase()
    );

    if (!matchedUser) {
      setLoginError("E-mail não cadastrado no portal.");
      return;
    }

    if (matchedUser.password !== loginPassword) {
      setLoginError("Senha incorreta. Tente novamente.");
      return;
    }

    // Success
    setCurrentUser(matchedUser);
    localStorage.setItem("portal_user", JSON.stringify(matchedUser));
    setLoginEmail("");
    setLoginPassword("");

    // Set default selected condominium if they are Síndico and have exactly 1 condo
    if (matchedUser.role === "Sindico" && matchedUser.condominiumIds && matchedUser.condominiumIds.length === 1) {
      setSelectedCondominiumId(matchedUser.condominiumIds[0]);
    } else {
      setSelectedCondominiumId(null);
    }

    // Register login event
    addDoc(collection(db, "auditoria"), {
      userId: matchedUser.id,
      userName: matchedUser.name,
      userRole: matchedUser.role,
      action: "Login",
      details: "Acessou o portal de prestação de contas",
      createdAt: new Date().toISOString(),
    });
  };

  // Logout handler
  const handleLogout = () => {
    if (currentUser) {
      addAuditLog("Logout", "Saiu do portal");
    }
    setCurrentUser(null);
    setSelectedCondominiumId(null);
    localStorage.removeItem("portal_user");
  };

  // Filter condominiums visible to the logged-in user
  const visibleCondos = condominios.filter((c) => {
    if (!currentUser) return false;
    if (currentUser.role === "SuperADM") return true;
    if (currentUser.role === "Administrador") {
      return c.administradoraId === currentUser.administradoraId;
    }
    // Síndico
    return currentUser.condominiumIds?.includes(c.id);
  });

  // Current selected condominium object
  const selectedCondominium = condominios.find((c) => c.id === selectedCondominiumId);
  const selectedCondoName = selectedCondominium ? selectedCondominium.name : "Selecione um condomínio";

  // Administradora name for current user
  const currentUserAdmName = currentUser?.administradoraId
    ? administradoras.find((a) => a.id === currentUser.administradoraId)?.name
    : "Portal de Condomínios";

  if (isSeeding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB] border-8 border-[#111111]">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-[#111111] border-t-transparent animate-spin mx-auto"></div>
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-[#111111]">Carregando nunesinformatica.online...</p>
        </div>
      </div>
    );
  }

  // --- LOGIN VIEW ---
  if (!currentUser) {
    return (
      <div id="loginView" className="min-h-screen flex flex-col border-8 border-[#111111] bg-[#FDFCFB] text-[#111111] font-sans">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12">
          {/* Left Branding Side */}
          <div className="lg:col-span-7 bg-[#F4F2EE] p-8 md:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#111111]">
            <div className="flex items-center gap-2">
              <span className="font-serif italic font-bold text-xl tracking-tight text-[#111111]">
                nunesinformatica.online
              </span>
            </div>

            <div className="my-16 space-y-6 max-w-xl">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60">
                Portal de Prestação de Contas
              </p>
              <h1 className="text-4xl md:text-6xl font-serif italic font-light tracking-tight leading-tight text-[#111111]">
                Nunes <br className="hidden md:inline" /> Informática
              </h1>
              <p className="text-[#111111] opacity-80 text-sm md:text-base leading-relaxed font-serif italic">
                Pastas de prestação de contas com acesso controlado e segurança irrestrita para conselhos e sindicatos.
              </p>
              <div className="w-16 h-[2px] bg-[#111111]"></div>
              <p className="text-xs text-[#111111] opacity-70 leading-relaxed">
                Cada administradora gerencia seus condomínios de forma isolada. Síndicos acessam e
                baixam pastas em PDF com total segurança, sem permissão de alteração.
              </p>
            </div>

            <div className="text-[10px] uppercase font-bold tracking-widest text-[#111111]/60 flex items-center gap-2 pt-6 border-t border-[#111111]/10">
              <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span>
              <span>Auditoria Completa & Controle de Privilégios</span>
            </div>
          </div>

          {/* Right Form Side */}
          <div className="lg:col-span-5 flex items-center justify-center p-6 md:p-12 bg-[#FDFCFB]">
            <div className="w-full max-w-md p-8 md:p-10 border border-[#111111] bg-white space-y-6 shadow-none">
              <div className="space-y-2 pb-4 border-b border-[#111111]/10">
                <p className="text-[9px] uppercase tracking-widest opacity-50">Portal Autorizado</p>
                <h2 className="text-2xl font-serif italic text-[#111111]">Acessar Portal</h2>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#111111] uppercase tracking-widest mb-2">
                    ID de Usuário (E-mail)
                  </label>
                  <input
                    type="email"
                    placeholder="seuemail@exemplo.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-none border border-[#111111] focus:bg-[#F4F2EE] outline-none transition-all text-sm bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#111111] uppercase tracking-widest mb-2">
                    Senha de Acesso
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-none border border-[#111111] focus:bg-[#F4F2EE] outline-none transition-all text-sm bg-white"
                    required
                  />
                </div>

                {loginError && (
                  <div className="p-3 text-xs font-serif italic text-red-700 bg-red-50 border border-red-200">
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#111111] hover:bg-[#C2A87E] text-white font-bold py-3 text-[11px] uppercase tracking-widest transition-colors cursor-pointer rounded-none border-2 border-[#111111]"
                >
                  Entrar no Portal
                </button>
              </form>

              <div className="pt-6 space-y-3">
                <span className="text-[9px] font-bold text-[#111111]/40 uppercase tracking-widest block">
                  Acesso Rápido para Demonstração:
                </span>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div
                    onClick={() => {
                      setLoginEmail("admin@portal.local");
                      setLoginPassword("admin123");
                    }}
                    className="p-3 border border-[#111111]/20 hover:border-[#111111] bg-[#FDFCFB] hover:bg-white cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-[#111111]">SuperADM (Edison)</div>
                      <div className="text-[10px] opacity-60 font-mono">admin@portal.local / admin123</div>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">Selecionar</span>
                  </div>

                  <div
                    onClick={() => {
                      setLoginEmail("adm.alpha@portal.local");
                      setLoginPassword("adm123");
                    }}
                    className="p-3 border border-[#111111]/20 hover:border-[#111111] bg-[#FDFCFB] hover:bg-white cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-[#111111]">Administrador Alpha</div>
                      <div className="text-[10px] opacity-60 font-mono">adm.alpha@portal.local / adm123</div>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">Selecionar</span>
                  </div>

                  <div
                    onClick={() => {
                      setLoginEmail("sindico.alpha@portal.local");
                      setLoginPassword("sindico123");
                    }}
                    className="p-3 border border-[#111111]/20 hover:border-[#111111] bg-[#FDFCFB] hover:bg-white cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-[#111111]">Síndico (Carlos)</div>
                      <div className="text-[10px] opacity-60 font-mono">sindico.alpha@portal.local / sindico123</div>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">Selecionar</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP PORTAL VIEW ---
  return (
    <div id="appView" className="min-h-screen flex flex-col md:flex-row bg-[#FDFCFB] text-[#111111] font-sans border-8 border-[#111111] overflow-hidden">
      
      {/* MOBILE HEADER */}
      <header className="md:hidden flex items-center justify-between bg-[#111111] text-white px-5 py-4 border-b border-[#111111]">
        <div className="flex items-center gap-2">
          <span className="font-serif italic font-bold tracking-wider text-base text-white">
            nunesinformatica.online
          </span>
        </div>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 hover:bg-[#C2A87E] transition-colors rounded-none"
        >
          {isSidebarOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
        </button>
      </header>

      {/* SIDEBAR CONTAINER */}
      <aside
        id="sidebarRoot"
        className={`fixed md:sticky top-0 left-0 bottom-0 z-40 w-72 bg-[#F4F2EE] text-[#111111] p-6 flex flex-col justify-between border-r border-[#111111] transition-transform duration-300 md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-6 flex-1 flex flex-col min-h-0">
          {/* Logo */}
          <div className="space-y-1 pb-6 border-b border-[#111111]">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60">Sistema de Gestão</p>
            <h1 className="font-serif italic text-2xl leading-none">Nunes <br/>Informática</h1>
          </div>

          {/* User Info Card */}
          <div className="space-y-2 py-4 border-b border-[#111111]/20">
            <p className="text-[9px] uppercase tracking-widest opacity-50">Acesso Autorizado</p>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-600"></div>
              <h4 id="userName" className="font-bold text-[#111111] text-sm truncate">{currentUser.name}</h4>
            </div>
            <p className="text-[11px] font-serif italic text-[#111111]/80">Nível: {currentUser.role}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-tighter truncate max-w-[200px]" title={currentUserAdmName}>
              {currentUserAdmName}
            </p>
          </div>

          {/* Condominium List Selection */}
          <div className="space-y-2 flex-1 flex flex-col min-h-0 pt-4">
            <p className="text-[9px] uppercase tracking-widest opacity-50 mb-1 flex items-center justify-between">
              <span>Nossos Condomínios</span>
              <span className="bg-[#111111] text-white px-2 py-0.5 text-[9px] uppercase font-bold">
                {visibleCondos.length}
              </span>
            </p>
            <div id="condominiumNav" className="overflow-y-auto space-y-1.5 pr-1 flex-1">
              {visibleCondos.length === 0 ? (
                <p className="text-xs text-gray-400 italic p-2 font-serif">Nenhum condomínio vinculado.</p>
              ) : (
                visibleCondos.map((condo) => {
                  const isSelected = condo.id === selectedCondominiumId;
                  return (
                    <button
                      key={condo.id}
                      onClick={() => {
                        setSelectedCondominiumId(condo.id);
                        setIsSidebarOpen(false); // close mobile sidebar on select
                      }}
                      className={`w-full text-left p-3 text-xs font-bold transition-all flex items-center justify-between cursor-pointer border-b border-[#111111]/10 ${
                        isSelected
                          ? "bg-[#111111] text-white"
                          : "text-[#111111] hover:bg-[#E5E5E5]/60 hover:text-[#111111]"
                      }`}
                    >
                      <span className="truncate">{condo.name}</span>
                      <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${isSelected ? "rotate-90 text-white" : "opacity-40"}`} />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Logout and bottom section */}
        <div className="pt-4 border-t border-[#111111] mt-6">
          <button
            id="logoutButton"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 justify-center py-2.5 border border-[#111111] bg-white hover:bg-red-50 text-[#111111] hover:text-red-700 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer rounded-none"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair da Conta
          </button>
          <div className="pt-4 text-center">
            <p className="text-[10px] uppercase font-bold tracking-tighter opacity-70">Portal de Prestação de Contas</p>
            <p className="text-[11px] opacity-60 italic font-serif">v. 2.4.0 • 2026</p>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
        />
      )}

      {/* WORKSPACE CONTENT AREA */}
      <main id="workspaceArea" className="flex-1 flex flex-col h-full min-w-0 overflow-y-auto">
        
        {/* Dynamic header depending on condominium selection */}
        <header className="border-b border-[#111111] p-8 md:p-10 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 bg-white">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.3em] font-bold">Unidade de Controle</p>
            <h1 id="condominiumTitle" className="text-3xl md:text-5xl font-serif italic tracking-tight text-[#111111]">
              {selectedCondoName}
            </h1>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[10px] uppercase font-bold opacity-40">Data de Referência</p>
            <p className="text-lg font-bold">{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
          </div>
        </header>

        {selectedCondominiumId && (
          <div className="bg-[#F4F2EE] border-b border-[#111111] px-6 py-3 flex flex-wrap gap-2">
            <button
              id="foldersTab"
              onClick={() => setActiveTab("folders")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                activeTab === "folders"
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-white text-[#111111] border-[#111111]/20 hover:border-[#111111]"
              }`}
            >
              <FolderKanban className="w-4 h-4" /> Pastas
            </button>
            <button
              id="protocolsTab"
              onClick={() => setActiveTab("protocols")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                activeTab === "protocols"
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-white text-[#111111] border-[#111111]/20 hover:border-[#111111]"
              }`}
            >
              <HelpCircle className="w-4 h-4" /> Protocolos
            </button>
            {(currentUser.role === "SuperADM" || currentUser.role === "Administrador") && (
              <button
                id="adminTab"
                onClick={() => setActiveTab("admin")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                  activeTab === "admin"
                    ? "bg-[#111111] text-white border-[#111111]"
                    : "bg-white text-[#111111] border-[#111111]/20 hover:border-[#111111]"
                }`}
              >
                <Users className="w-4 h-4" /> Controle de Acesso
              </button>
            )}
            <button
              id="auditTab"
              onClick={() => setActiveTab("audit")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                activeTab === "audit"
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-white text-[#111111] border-[#111111]/20 hover:border-[#111111]"
              }`}
            >
              <ShieldCheck className="w-4 h-4" /> Auditoria
            </button>
          </div>
        )}

        {/* WORKSPACE VIEWS */}
        <div className="flex-1 p-6 md:p-8 bg-[#FDFCFB]">
          {selectedCondominiumId ? (
            <div className="h-full">
              {/* TABS VIEW RENDER */}
              {activeTab === "folders" && (
                <FoldersTab
                  currentUser={currentUser}
                  selectedCondominiumId={selectedCondominiumId}
                  folders={folders}
                  files={files}
                  onRefresh={() => {}}
                  onAddAuditLog={addAuditLog}
                  condominiumName={selectedCondoName}
                />
              )}

              {activeTab === "protocols" && (
                <ProtocolsTab
                  currentUser={currentUser}
                  selectedCondominiumId={selectedCondominiumId}
                  protocols={protocols}
                  messages={messages}
                  onRefresh={() => {}}
                  onAddAuditLog={addAuditLog}
                  condominiumName={selectedCondoName}
                />
              )}

              {activeTab === "admin" && (currentUser.role === "SuperADM" || currentUser.role === "Administrador") && (
                <AdminPanel
                  currentUser={currentUser}
                  administradoras={administradoras}
                  condominios={condominios}
                  usuarios={usuarios}
                  onRefresh={() => {}}
                  onAddAuditLog={addAuditLog}
                />
              )}

              {activeTab === "audit" && (
                <AuditTab
                  currentUser={currentUser}
                  auditLogs={auditLogs}
                  condominiumIds={currentUser.condominiumIds || []}
                />
              )}
            </div>
          ) : (
            /* NO CONDOMINIUM SELECTED VIEW */
            <div className="bg-white border border-[#111111] p-12 text-center flex flex-col items-center justify-center min-h-[450px]">
              <div className="p-4 bg-[#F4F2EE] text-[#111111] border border-[#111111] mb-6">
                <Building className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-serif italic text-[#111111]">Bem-vindo, {currentUser.name}!</h3>
              <p className="text-xs text-[#111111] opacity-70 max-w-sm mt-3 leading-relaxed">
                Selecione um condomínio na barra lateral para acessar as pastas mensais de prestação de contas, fazer downloads de relatórios ou abrir chamados/demandas técnicas.
              </p>

              {(currentUser.role === "SuperADM" || currentUser.role === "Administrador") && (
                <div className="mt-8 pt-6 border-t border-[#111111]/20 w-full max-w-sm">
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-60 mb-3">Acesso Administrativo:</p>
                  <button
                    onClick={() => {
                      if (visibleCondos.length > 0) {
                        setSelectedCondominiumId(visibleCondos[0].id);
                        setActiveTab("admin");
                      } else {
                        alert("Por favor, crie uma administradora ou condomínio primeiro!");
                      }
                    }}
                    className="border-2 border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white text-[11px] uppercase font-bold tracking-widest px-6 py-2.5 transition-all cursor-pointer inline-flex items-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4" /> Acessar Configurações
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
