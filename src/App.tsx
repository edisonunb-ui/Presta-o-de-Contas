import React, { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, doc, updateDoc } from "firebase/firestore";
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
  Users,
  Palette,
  Home
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
  const [loginMatches, setLoginMatches] = useState<User[]>([]);

  // Registration states
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState<'Administrador' | 'Sindico'>("Sindico");
  const [regAdmId, setRegAdmId] = useState("");
  const [regCondoId, setRegCondoId] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [regError, setRegError] = useState("");

  // Password change states (first access)
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState("");
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState("");

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
  const [dbError, setDbError] = useState<string>("");

  // Theme state: 'emerald' | 'dark' | 'burgundy'
  const [theme, setTheme] = useState<"emerald" | "dark" | "burgundy">(() => {
    const saved = localStorage.getItem("portal_theme");
    return (saved as "emerald" | "dark" | "burgundy") || "emerald";
  });

  // Apply theme to body
  useEffect(() => {
    localStorage.setItem("portal_theme", theme);
    const body = document.body;
    body.classList.remove("theme-dark", "theme-burgundy");
    if (theme !== "emerald") {
      body.classList.add(`theme-${theme}`);
    }
  }, [theme]);

  // Registration handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    setRegSuccess("");

    if (!regEmail.trim() || !regPassword.trim() || !regName.trim() || !regRole) {
      setRegError("Preencha todos os campos obrigatórios.");
      return;
    }

    const duplicateProfileExists = usuarios.some((u) => {
      const sameEmail = u.email.toLowerCase() === regEmail.trim().toLowerCase();
      if (!sameEmail) return false;
      if (regRole === "Sindico") {
        return u.role === "Sindico" && u.condominiumIds?.includes(regCondoId);
      } else {
        return u.role === "Administrador" && u.administradoraId === regAdmId;
      }
    });
    if (duplicateProfileExists) {
      setRegError("Este e-mail já está cadastrado com este mesmo vínculo (condomínio/administradora)!");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "usuarios"), {
        email: regEmail.trim().toLowerCase(),
        password: regPassword.trim(),
        name: regName.trim(),
        role: regRole,
        administradoraId: regAdmId || "",
        condominiumIds: regRole === "Sindico" && regCondoId ? [regCondoId] : [],
        createdAt: new Date().toISOString(),
        firstAccess: true, // Force password change on first login
      });
      await updateDoc(doc(db, "usuarios", docRef.id), { id: docRef.id });

      // Log autocadastro audit event
      await addDoc(collection(db, "auditoria"), {
        userId: docRef.id,
        userName: regName.trim(),
        userRole: regRole,
        action: "Autocadastro",
        details: `Usuário se autocadastrou no portal com e-mail: ${regEmail.trim().toLowerCase()}`,
        createdAt: new Date().toISOString(),
      });

      setRegSuccess("Cadastro realizado com sucesso! Use seus dados para entrar.");
      setLoginEmail(regEmail.trim().toLowerCase());
      
      // Clear registration form
      setRegName("");
      setRegEmail("");
      setRegPassword("");
      setRegRole("Sindico");
      setRegAdmId("");
      setRegCondoId("");
      
      setTimeout(() => {
        setIsRegistering(false);
        setRegSuccess("");
      }, 2500);

    } catch (err) {
      console.error("Registration error:", err);
      setRegError("Erro ao registrar no banco de dados. Tente novamente.");
    }
  };

  // Change password handler (first access)
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError("");

    if (!newPassword.trim()) {
      setPasswordChangeError("A senha não pode ser vazia.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordChangeError("A senha deve conter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError("As senhas não coincidem.");
      return;
    }

    if (!currentUser) return;

    try {
      await updateDoc(doc(db, "usuarios", currentUser.id), {
        password: newPassword.trim(),
        firstAccess: false,
      });

      // Audit Log
      await addDoc(collection(db, "auditoria"), {
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: "Alteração de Senha",
        details: "Alterou a senha provisória com sucesso no primeiro acesso",
        createdAt: new Date().toISOString(),
      });

      // Update state and localStorage
      const updatedUser: User = { 
        ...currentUser, 
        password: newPassword.trim(), 
        firstAccess: false 
      };
      setCurrentUser(updatedUser);
      localStorage.setItem("portal_user", JSON.stringify(updatedUser));

      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordChangeSuccess("Sua senha foi alterada com sucesso!");

      setTimeout(() => {
        setPasswordChangeSuccess("");
      }, 3000);

    } catch (err) {
      console.error("Password change error:", err);
      setPasswordChangeError("Erro ao atualizar a senha no servidor. Tente novamente.");
    }
  };

  // 1. Seed database and subscribe to collections on mount
  useEffect(() => {
    const runSeedAndSub = async () => {
      try {
        await seedDatabaseIfEmpty();
      } catch (err) {
        console.error("Seeding error:", err);
        setDbError("Erro ao inicializar banco: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsSeeding(false);
      }
    };
    runSeedAndSub();

    // Set up real-time listeners for all Firestore collections
    const unsubUsers = onSnapshot(collection(db, "usuarios"), (snapshot) => {
      const list: User[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id } as User);
      });
      setUsuarios(list);
    }, (error) => {
      console.error("Users load error:", error);
      setDbError("Erro de acesso ao banco (usuarios): " + error.message);
    });

    const unsubAdms = onSnapshot(collection(db, "administradoras"), (snapshot) => {
      const list: Administradora[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id } as Administradora);
      });
      setAdministradoras(list);
    }, (error) => {
      console.error("Adms load error:", error);
      setDbError("Erro de acesso ao banco (administradoras): " + error.message);
    });

    const unsubCondos = onSnapshot(collection(db, "condominios"), (snapshot) => {
      const list: Condominium[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id } as Condominium);
      });
      setCondominios(list);
    }, (error) => {
      console.error("Condos load error:", error);
      setDbError("Erro de acesso ao banco (condominios): " + error.message);
    });

    const unsubPastas = onSnapshot(collection(db, "pastas"), (snapshot) => {
      const list: Folder[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id } as Folder);
      });
      setFolders(list);
    }, (error) => {
      console.error("Pastas load error:", error);
      setDbError("Erro de acesso ao banco (pastas): " + error.message);
    });

    const unsubArquivos = onSnapshot(collection(db, "arquivos"), (snapshot) => {
      const list: FileEntry[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id } as FileEntry);
      });
      setFiles(list);
    }, (error) => {
      console.error("Arquivos load error:", error);
      setDbError("Erro de acesso ao banco (arquivos): " + error.message);
    });

    const unsubProtos = onSnapshot(collection(db, "protocolos"), (snapshot) => {
      const list: Protocol[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id } as Protocol);
      });
      setProtocols(list);
    }, (error) => {
      console.error("Protocolos load error:", error);
      setDbError("Erro de acesso ao banco (protocolos): " + error.message);
    });

    const unsubMsgs = onSnapshot(collection(db, "mensagens"), (snapshot) => {
      const list: Message[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id } as Message);
      });
      setMessages(list);
    }, (error) => {
      console.error("Mensagens load error:", error);
      setDbError("Erro de acesso ao banco (mensagens): " + error.message);
    });

    const unsubAudit = onSnapshot(collection(db, "auditoria"), (snapshot) => {
      const list: AuditLog[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id } as AuditLog);
      });
      setAuditLogs(list);
    }, (error) => {
      console.error("Auditoria load error:", error);
      setDbError("Erro de acesso ao banco (auditoria): " + error.message);
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

    const sameEmailUsers = usuarios.filter(
      (u) => u.email.toLowerCase() === loginEmail.trim().toLowerCase()
    );

    if (sameEmailUsers.length === 0) {
      setLoginError("E-mail não cadastrado no portal.");
      return;
    }

    const passwordMatches = sameEmailUsers.filter(u => u.password === loginPassword);
    if (passwordMatches.length === 0) {
      setLoginError("Senha incorreta. Tente novamente.");
      return;
    }

    if (passwordMatches.length === 1) {
      const matchedUser = passwordMatches[0];
      // Success
      setCurrentUser(matchedUser);
      localStorage.setItem("portal_user", JSON.stringify(matchedUser));
      setLoginEmail("");
      setLoginPassword("");
      setLoginMatches([]);

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
    } else {
      // More than 1 profile matches email and password
      setLoginMatches(passwordMatches);
    }
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
  let selectedCondoName = selectedCondominium ? selectedCondominium.name : "Selecione um condomínio";
  if (!selectedCondominiumId) {
    if (activeTab === "admin") {
      selectedCondoName = "Painel de Administração Global";
    } else if (activeTab === "audit") {
      selectedCondoName = "Painel de Auditoria Geral";
    }
  }

  // Administradora name for current user
  const currentUserAdmName = currentUser?.administradoraId
    ? administradoras.find((a) => a.id === currentUser.administradoraId)?.name
    : "Portal de Condomínios";

  // Dynamic tab permissions based on role & granular settings
  const canViewFolders = currentUser ? (currentUser.role === "SuperADM" || currentUser.permissions?.folders_view !== false) : false;
  const canViewProtocols = currentUser ? (currentUser.role === "SuperADM" || currentUser.permissions?.protocols_view === true) : false;
  const canViewAdmin = currentUser ? (
    currentUser.role === "SuperADM" || 
    (currentUser.role === "Administrador" && (currentUser.permissions?.register_sindicos === true || currentUser.permissions?.register_condos === true))
  ) : false;
  const canViewAudit = currentUser ? (currentUser.role === "SuperADM" || currentUser.permissions?.view_audit_logs === true) : false;

  if (isSeeding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] border-4 md:border-8 border-[#123E33]">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-[#123E33] border-t-transparent animate-spin mx-auto"></div>
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-[#123E33]">Carregando nunesinformatica.online...</p>
        </div>
      </div>
    );
  }

  // --- LOGIN & REGISTER VIEW ---
  if (!currentUser) {
    return (
      <div id="loginView" className="min-h-screen flex flex-col border-4 md:border-8 border-[#123E33] bg-[#FAF9F6] text-[#123E33] font-sans overflow-x-hidden">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12">
          {/* Left Branding Side */}
          <div 
            className="lg:col-span-7 p-8 md:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#123E33] bg-cover bg-center text-white relative min-h-[400px] lg:min-h-0"
            style={{ 
              backgroundImage: "linear-gradient(180deg, rgba(18, 62, 51, 0.75) 0%, rgba(12, 40, 33, 0.95) 100%), url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80')" 
            }}
          >
            <div className="flex items-center gap-2 relative z-10">
              <span className="font-serif italic font-bold text-xl tracking-tight text-white/90">
                nunesinformatica.online
              </span>
            </div>

            <div className="my-12 lg:my-16 space-y-6 max-w-xl relative z-10">
              <p className="text-[10px] uppercase tracking-[0.25em] font-extrabold text-[#C2A87E]">
                Portal de Condomínios
              </p>
              <h1 className="text-4xl md:text-6xl font-serif italic tracking-tight leading-tight text-white font-light">
                Pastas de prestação <br /> de contas com <br /> acesso controlado.
              </h1>
              <div className="w-16 h-[2px] bg-[#C2A87E]/60"></div>
              <p className="text-sm text-white/90 font-light leading-relaxed">
                Cada administrador vê apenas os condomínios permitidos. Síndicos podem ficar somente com leitura e download, sem mexer nos arquivos.
              </p>
            </div>

            <div className="text-[10px] uppercase font-bold tracking-widest text-white/70 flex items-center gap-2 pt-6 border-t border-white/10 relative z-10">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span>Auditoria Completa & Controle de Privilégios</span>
            </div>
          </div>

          {/* Right Form Side */}
          <div className="lg:col-span-5 flex items-center justify-center p-6 md:p-12 bg-[#FAF9F6]">
            <div className="w-full max-w-md p-8 md:p-10 bg-white rounded-2xl shadow-xl space-y-6 border border-gray-100">
              
              {isRegistering ? (
                <div className="space-y-6">
                  <div className="space-y-2 pb-4 border-b border-[#123E33]/10">
                    <p className="text-[10px] uppercase tracking-widest text-[#123E33] font-bold">Crie seu Acesso</p>
                    <h2 className="text-2xl font-serif italic text-[#123E33]">Cadastrar Conta</h2>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: João Silva"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-[#123E33] focus:ring-1 focus:ring-[#123E33] outline-none transition-all text-sm bg-white"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          E-mail (ID)
                        </label>
                        <input
                          type="email"
                          placeholder="seu@email.com"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-[#123E33] focus:ring-1 focus:ring-[#123E33] outline-none transition-all text-sm bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Senha Inicial
                        </label>
                        <input
                          type="password"
                          placeholder="Min. 6 caracteres"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-[#123E33] focus:ring-1 focus:ring-[#123E33] outline-none transition-all text-sm bg-white"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Tipo de Permissão
                      </label>
                      <select
                        value={regRole}
                        onChange={(e) => setRegRole(e.target.value as "Administrador" | "Sindico")}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-[#123E33] focus:ring-1 focus:ring-[#123E33] outline-none transition-all text-sm bg-white"
                        required
                      >
                        <option value="Sindico">Síndico (Apenas Visualização)</option>
                        <option value="Administrador">Administrador (Gestor)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Vincular à Administradora
                      </label>
                      <select
                        value={regAdmId}
                        onChange={(e) => {
                          setRegAdmId(e.target.value);
                          setRegCondoId("");
                        }}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-[#123E33] focus:ring-1 focus:ring-[#123E33] outline-none transition-all text-sm bg-white"
                        required
                      >
                        <option value="">Selecione...</option>
                        {administradoras.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {regRole === "Sindico" && regAdmId && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Selecione seu Condomínio
                        </label>
                        <select
                          value={regCondoId}
                          onChange={(e) => setRegCondoId(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-[#123E33] focus:ring-1 focus:ring-[#123E33] outline-none transition-all text-sm bg-white"
                          required
                        >
                          <option value="">Selecione...</option>
                          {condominios
                            .filter((c) => c.administradoraId === regAdmId)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    {regError && (
                      <div className="p-3 text-xs font-serif italic text-red-700 bg-red-50 border border-red-200 rounded-lg">
                        {regError}
                      </div>
                    )}

                    {regSuccess && (
                      <div className="p-3 text-xs font-serif italic text-green-700 bg-green-50 border border-green-200 rounded-lg animate-pulse">
                        {regSuccess}
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        type="submit"
                        className="w-full bg-[#123E33] hover:bg-[#0d2a23] text-white font-bold py-3 text-xs uppercase tracking-widest transition-colors cursor-pointer rounded-lg border-none"
                      >
                        Cadastrar no Portal
                      </button>
                    </div>
                  </form>

                  <div className="text-center pt-2">
                    <button
                      onClick={() => {
                        setIsRegistering(false);
                        setRegError("");
                        setRegSuccess("");
                      }}
                      className="text-xs text-[#123E33] font-bold underline hover:text-[#C2A87E] transition-colors cursor-pointer"
                    >
                      Já tem acesso? Faça Login
                    </button>
                  </div>
                </div>
              ) : loginMatches.length > 0 ? (
                <>
                  <div className="space-y-1.5 pb-2 text-center">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 font-serif italic">Selecione seu Perfil</h2>
                    <p className="text-xs text-gray-500">Múltiplos perfis encontrados com este e-mail. Escolha qual deseja acessar:</p>
                  </div>

                  <div className="space-y-3 py-2 max-h-80 overflow-y-auto">
                    {loginMatches.map((matchedUser) => {
                      const adm = administradoras.find(a => a.id === matchedUser.administradoraId);
                      const condos = condominios.filter(c => matchedUser.condominiumIds?.includes(c.id));
                      
                      return (
                        <button
                          key={matchedUser.id}
                          onClick={() => {
                            setCurrentUser(matchedUser);
                            localStorage.setItem("portal_user", JSON.stringify(matchedUser));
                            setLoginEmail("");
                            setLoginPassword("");
                            setLoginMatches([]);

                            if (matchedUser.role === "Sindico" && matchedUser.condominiumIds && matchedUser.condominiumIds.length === 1) {
                              setSelectedCondominiumId(matchedUser.condominiumIds[0]);
                            } else {
                              setSelectedCondominiumId(null);
                            }

                            addDoc(collection(db, "auditoria"), {
                              userId: matchedUser.id,
                              userName: matchedUser.name,
                              userRole: matchedUser.role,
                              action: "Login (Multi-perfil)",
                              details: `Acessou como ${matchedUser.role} - Perfil: ${matchedUser.name}`,
                              createdAt: new Date().toISOString(),
                            });
                          }}
                          className="w-full text-left p-3.5 border border-gray-200 hover:border-[#123E33] hover:bg-[#FAF9F6] transition-all rounded-lg flex flex-col gap-1 cursor-pointer group"
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-bold text-sm text-[#111111] group-hover:text-[#123E33] transition-colors">
                              {matchedUser.name}
                            </span>
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 border rounded-none ${
                              matchedUser.role === "SuperADM" 
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : matchedUser.role === "Administrador"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-[#123E33]/5 text-[#123E33] border-[#123E33]/20"
                            }`}>
                              {matchedUser.role}
                            </span>
                          </div>
                          
                          <div className="text-[10px] text-gray-500 font-serif italic">
                            {adm && <div>🏢 Administradora: <span className="font-sans font-bold text-gray-700 uppercase text-[9px]">{adm.name}</span></div>}
                            {condos.length > 0 && (
                              <div className="mt-0.5 truncate">
                                🏠 Condomínios: <span className="font-sans font-bold text-gray-700 text-[9px]">{condos.map(c => c.name).join(", ")}</span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-3 text-center border-t border-gray-100">
                    <button
                      onClick={() => {
                        setLoginMatches([]);
                        setLoginPassword("");
                      }}
                      className="text-xs font-bold text-[#123E33] hover:text-[#C2A87E] transition-colors underline cursor-pointer"
                    >
                      Voltar para o Login
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5 pb-2">
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900">Entrar</h2>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        E-mail
                      </label>
                      <input
                        type="email"
                        placeholder="edisonunb@gmail.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#123E33] focus:ring-1 focus:ring-[#123E33] outline-none transition-all text-sm bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Senha
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#123E33] focus:ring-1 focus:ring-[#123E33] outline-none transition-all text-sm bg-white"
                        required
                      />
                    </div>

                    {loginError && (
                      <div className="p-3 text-xs font-serif italic text-red-700 bg-red-50 border border-red-200 rounded-lg">
                        {loginError}
                      </div>
                    )}

                    {dbError && (
                      <div className="p-3 text-xs font-mono text-red-700 bg-red-50 border border-red-200 rounded-lg whitespace-pre-wrap">
                        <strong>Erro de Banco de Dados:</strong><br />
                        {dbError}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-[#123E33] hover:bg-[#0d2a23] text-white font-bold py-3 text-sm tracking-wide transition-all cursor-pointer rounded-lg border-none"
                    >
                      Acessar portal
                    </button>
                  </form>

                  {/* Apenas o SuperADM pode cadastrar novos usuários internamente */}
                </>
              )}

              <div className="pt-6 space-y-3">
                <span className="text-[9px] font-bold text-[#123E33]/40 uppercase tracking-widest block">
                  Acesso Rápido para Demonstração:
                </span>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div
                    onClick={() => {
                      setLoginEmail("edisonunb@gmail.com");
                      setLoginPassword("123mudar");
                    }}
                    className="p-3 border border-[#123E33]/20 hover:border-[#123E33] bg-[#FAF9F6] hover:bg-white cursor-pointer transition-colors flex items-center justify-between rounded-lg"
                  >
                    <div>
                      <div className="font-bold text-[#123E33]">SuperADM (Edison)</div>
                      <div className="text-[10px] opacity-60 font-mono">edisonunb@gmail.com / 123mudar</div>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">Selecionar</span>
                  </div>

                  <div
                    onClick={() => {
                      setLoginEmail("adm.alpha@portal.local");
                      setLoginPassword("adm123");
                    }}
                    className="p-3 border border-[#123E33]/20 hover:border-[#123E33] bg-[#FAF9F6] hover:bg-white cursor-pointer transition-colors flex items-center justify-between rounded-lg"
                  >
                    <div>
                      <div className="font-bold text-[#123E33]">Administrador Alpha</div>
                      <div className="text-[10px] opacity-60 font-mono">adm.alpha@portal.local / adm123</div>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">Selecionar</span>
                  </div>

                  <div
                    onClick={() => {
                      setLoginEmail("sindico.alpha@portal.local");
                      setLoginPassword("sindico123");
                    }}
                    className="p-3 border border-[#123E33]/20 hover:border-[#123E33] bg-[#FAF9F6] hover:bg-white cursor-pointer transition-colors flex items-center justify-between rounded-lg"
                  >
                    <div>
                      <div className="font-bold text-[#123E33]">Síndico (Carlos)</div>
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

  // --- PASSWORD CHANGE FORCE SCREEN (FIRST ACCESS) ---
  if (currentUser && currentUser.firstAccess === true) {
    return (
      <div id="passwordForceView" className="min-h-screen flex items-center justify-center border-4 md:border-8 border-[#123E33] bg-[#FAF9F6] text-[#123E33] font-sans p-4 sm:p-6 overflow-x-hidden">
        <div className="w-full max-w-md p-8 md:p-10 border border-[#123E33] bg-white space-y-6 shadow-none">
          <div className="space-y-2 pb-4 border-b border-[#123E33]/10 text-center">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C2A87E] inline-block animate-pulse mb-1"></span>
            <p className="text-[10px] uppercase tracking-widest opacity-60">Segurança de Acesso</p>
            <h2 className="text-3xl font-serif italic text-[#123E33]">Primeiro Acesso</h2>
            <p className="text-xs text-gray-500 font-serif italic mt-1">Por favor, altere sua senha provisória por questões de segurança.</p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-[#123E33] uppercase tracking-widest mb-2">
                Nova Senha de Acesso
              </label>
              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-none border border-[#123E33] focus:bg-[#EEF2F0] outline-none transition-all text-sm bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#123E33] uppercase tracking-widest mb-2">
                Confirme a Nova Senha
              </label>
              <input
                type="password"
                placeholder="Confirme sua nova senha"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-none border border-[#123E33] focus:bg-[#EEF2F0] outline-none transition-all text-sm bg-white"
                required
              />
            </div>

            {passwordChangeError && (
              <div className="p-3 text-xs font-serif italic text-red-700 bg-red-50 border border-red-200">
                {passwordChangeError}
              </div>
            )}

            {passwordChangeSuccess && (
              <div className="p-3 text-xs font-serif italic text-green-700 bg-green-50 border border-green-200 animate-pulse">
                {passwordChangeSuccess}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#123E33] hover:bg-[#C2A87E] text-white font-bold py-3 text-xs uppercase tracking-widest transition-colors cursor-pointer rounded-none border border-[#123E33]"
            >
              Salvar Nova Senha
            </button>
            
            <button
              type="button"
              onClick={handleLogout}
              className="w-full bg-white hover:bg-gray-50 text-gray-500 font-bold py-2.5 text-[10px] uppercase tracking-widest transition-colors cursor-pointer rounded-none border border-gray-300"
            >
              Voltar ao Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- MAIN APP PORTAL VIEW ---
  return (
    <div id="appView" className="min-h-screen flex flex-col md:flex-row bg-[#FAF9F6] text-[#123E33] font-sans border-4 md:border-8 border-[#123E33] overflow-x-hidden md:overflow-hidden">
      
      {/* MOBILE HEADER */}
      <header className="md:hidden flex items-center justify-between bg-[#123E33] text-white px-5 py-4 border-b border-[#123E33]">
        <div 
          onClick={() => {
            setSelectedCondominiumId("");
            setActiveTab("folders");
            setIsSidebarOpen(false);
          }}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          title="Ir para a Página Inicial"
        >
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
        className={`fixed md:sticky top-0 left-0 bottom-0 z-40 w-72 bg-[#EEF2F0] text-[#123E33] p-6 flex flex-col justify-between border-r border-[#123E33] transition-transform duration-300 md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-6 flex-1 flex flex-col min-h-0">
          {/* Logo */}
          <div 
            onClick={() => {
              setSelectedCondominiumId("");
              setActiveTab("folders");
              setIsSidebarOpen(false);
            }}
            className="space-y-1 pb-6 border-b border-[#123E33] cursor-pointer hover:opacity-80 transition-all group"
            title="Ir para a Página Inicial"
          >
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60 group-hover:text-[#C2A87E] transition-colors">Sistema de Gestão</p>
            <h1 className="font-serif italic text-2xl leading-none group-hover:text-[#C2A87E] transition-colors">Nunes <br/>Informática</h1>
          </div>

          {/* User Info Card */}
          <div className="space-y-2 py-4 border-b border-[#123E33]/20">
            <p className="text-[9px] uppercase tracking-widest opacity-50">Acesso Autorizado</p>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-600"></div>
              <h4 id="userName" className="font-bold text-[#123E33] text-sm truncate">{currentUser.name}</h4>
            </div>
            <p className="text-[11px] font-serif italic text-[#123E33]/80">Nível: {currentUser.role}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-tighter truncate max-w-[200px]" title={currentUserAdmName}>
              {currentUserAdmName}
            </p>
          </div>

          {/* Home Button */}
          <button
            onClick={() => {
              setSelectedCondominiumId("");
              setActiveTab("folders");
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
              !selectedCondominiumId && activeTab !== "admin" && activeTab !== "audit"
                ? "bg-[#123E33] text-white border-[#123E33]"
                : "bg-white text-[#123E33] border-[#123E33]/20 hover:border-[#123E33]"
            }`}
            title="Ir para a Página Inicial"
          >
            <Home className="w-4 h-4" /> Início / Home
          </button>

          {/* Condominium List Selection */}
          <div className="space-y-2 flex-1 flex flex-col min-h-0 pt-2">
            <p className="text-[9px] uppercase tracking-widest opacity-50 mb-1 flex items-center justify-between">
              <span>Nossos Condomínios</span>
              <span className="bg-[#123E33] text-white px-2 py-0.5 text-[9px] uppercase font-bold">
                {visibleCondos.length}
              </span>
            </p>
            <div id="condominiumNav" className="overflow-y-auto space-y-3 pr-1 flex-1">
              {visibleCondos.length === 0 ? (
                <p className="text-xs text-gray-400 italic p-2 font-serif">Nenhum condomínio vinculado.</p>
              ) : (
                currentUser?.role === "SuperADM" || Array.from(new Set(visibleCondos.map(c => c.administradoraId))).length > 1 ? (
                  <>
                    {administradoras
                      .map((adm) => {
                        const admCondos = visibleCondos.filter(c => c.administradoraId === adm.id);
                        if (admCondos.length === 0) return null;
                        return (
                          <div key={adm.id} className="space-y-1">
                            <div className="text-[9px] uppercase tracking-wider font-bold text-[#123E33]/60 px-2 py-1 bg-[#123E33]/5 border-l-2 border-[#123E33] truncate">
                              🏢 {adm.name}
                            </div>
                            <div className="space-y-0.5 pl-1">
                              {admCondos.map((condo) => {
                                const isSelected = condo.id === selectedCondominiumId;
                                return (
                                  <button
                                    key={condo.id}
                                    onClick={() => {
                                      setSelectedCondominiumId(condo.id);
                                      setIsSidebarOpen(false);
                                    }}
                                    className={`w-full text-left p-2.5 px-3 text-[11px] font-bold transition-all flex items-center justify-between cursor-pointer border-b border-[#123E33]/5 ${
                                      isSelected
                                        ? "bg-[#123E33] text-white"
                                        : "text-[#123E33] hover:bg-[#C2A87E]/10"
                                    }`}
                                  >
                                    <span className="truncate">{condo.name}</span>
                                    <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${isSelected ? "rotate-90 text-white" : "opacity-30"}`} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    {visibleCondos.filter(c => !c.administradoraId).length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[9px] uppercase tracking-wider font-bold text-red-700/60 px-2 py-1 bg-red-50 border-l-2 border-red-500 truncate">
                          ⚠️ Sem Administradora
                        </div>
                        <div className="space-y-0.5 pl-1">
                          {visibleCondos.filter(c => !c.administradoraId).map((condo) => {
                            const isSelected = condo.id === selectedCondominiumId;
                            return (
                              <button
                                key={condo.id}
                                onClick={() => {
                                  setSelectedCondominiumId(condo.id);
                                  setIsSidebarOpen(false);
                                }}
                                className={`w-full text-left p-2.5 px-3 text-[11px] font-bold transition-all flex items-center justify-between cursor-pointer border-b border-[#123E33]/5 ${
                                  isSelected
                                    ? "bg-[#123E33] text-white"
                                    : "text-red-700 hover:bg-red-50/50"
                                }`}
                              >
                                <span className="truncate">{condo.name}</span>
                                <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${isSelected ? "rotate-90 text-white" : "opacity-30"}`} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
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
                        className={`w-full text-left p-3 text-xs font-bold transition-all flex items-center justify-between cursor-pointer border-b border-[#123E33]/10 ${
                          isSelected
                            ? "bg-[#123E33] text-white"
                            : "text-[#123E33] hover:bg-[#C2A87E]/20 hover:text-[#123E33]"
                        }`}
                      >
                        <span className="truncate">{condo.name}</span>
                        <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${isSelected ? "rotate-90 text-white" : "opacity-40"}`} />
                      </button>
                    );
                  })
                )
              )}
            </div>
          </div>
        </div>

        {/* Theme Switcher Selection */}
        <div className="py-4 border-t border-[#123E33]/20 space-y-2 mt-4">
          <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest opacity-50 font-bold">
            <Palette className="w-3 h-3" />
            <span>Tema do Portal</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => setTheme("emerald")}
              className={`py-1.5 px-1 text-[9px] uppercase font-bold tracking-wider transition-all border flex flex-col items-center gap-1 cursor-pointer rounded-none ${
                theme === "emerald"
                  ? "bg-[#123E33] text-white border-[#123E33]"
                  : "bg-white text-[#123E33] border-[#123E33]/20 hover:bg-[#EEF2F0]"
              }`}
              title="Tema Clássico Verde Esmeralda"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#123E33] border border-white/20"></span>
              <span>Claro</span>
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`py-1.5 px-1 text-[9px] uppercase font-bold tracking-wider transition-all border flex flex-col items-center gap-1 cursor-pointer rounded-none ${
                theme === "dark"
                  ? "bg-[#1E293B] text-white border-[#1E293B]"
                  : "bg-white text-[#123E33] border-[#123E33]/20 hover:bg-[#EEF2F0]"
              }`}
              title="Tema Escuro Obsidiana"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#0B0F19] border border-white/20"></span>
              <span>Escuro</span>
            </button>
            <button
              onClick={() => setTheme("burgundy")}
              className={`py-1.5 px-1 text-[9px] uppercase font-bold tracking-wider transition-all border flex flex-col items-center gap-1 cursor-pointer rounded-none ${
                theme === "burgundy"
                  ? "bg-[#5C1D24] text-white border-[#5C1D24]"
                  : "bg-white text-[#123E33] border-[#123E33]/20 hover:bg-[#EEF2F0]"
              }`}
              title="Tema Imperial Vinho Nobre"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#5C1D24] border border-white/20"></span>
              <span>Vinho</span>
            </button>
          </div>
        </div>

        {/* Logout and bottom section */}
        <div className="pt-4 border-t border-[#123E33] mt-6">
          <button
            id="logoutButton"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 justify-center py-2.5 border border-[#123E33] bg-white hover:bg-red-50 text-[#123E33] hover:text-red-700 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer rounded-none"
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
      <main id="workspaceArea" className="flex-1 flex flex-col h-full min-w-0 overflow-y-auto overflow-x-hidden">
        
        {dbError && (
          <div className="bg-red-50 border-b border-red-200 text-red-800 px-8 py-3 text-xs font-medium flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
              <span><strong>Aviso de Conexão:</strong> {dbError}</span>
            </div>
            <button 
              onClick={() => {
                setDbError("");
                window.location.reload();
              }} 
              className="underline text-red-900 hover:text-red-950 font-bold bg-transparent border-none cursor-pointer"
            >
              Recarregar Sistema
            </button>
          </div>
        )}
        
        {/* Dynamic header depending on condominium selection */}
        <header className="border-b border-[#123E33] p-4 sm:p-8 md:p-10 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 bg-white">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.3em] font-bold">Unidade de Controle</p>
            <h1 id="condominiumTitle" className="text-3xl md:text-5xl font-serif italic tracking-tight text-[#123E33]">
              {selectedCondoName}
            </h1>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[10px] uppercase font-bold opacity-40">Data de Referência</p>
            <p className="text-lg font-bold">{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
          </div>
        </header>

        {(canViewFolders || canViewProtocols || canViewAdmin || canViewAudit) && (
          <div className="bg-[#EEF2F0] border-b border-[#123E33] px-6 py-3 flex flex-wrap gap-2">
            {selectedCondominiumId && canViewFolders && (
              <button
                id="foldersTab"
                onClick={() => setActiveTab("folders")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                  activeTab === "folders"
                    ? "bg-[#123E33] text-white border-[#123E33]"
                    : "bg-white text-[#123E33] border-[#123E33]/20 hover:border-[#123E33]"
                }`}
              >
                <FolderKanban className="w-4 h-4" /> Pastas
              </button>
            )}
            {selectedCondominiumId && canViewProtocols && (
              <button
                id="protocolsTab"
                onClick={() => setActiveTab("protocols")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                  activeTab === "protocols"
                    ? "bg-[#123E33] text-white border-[#123E33]"
                    : "bg-white text-[#123E33] border-[#123E33]/20 hover:border-[#123E33]"
                }`}
              >
                <HelpCircle className="w-4 h-4" /> Protocolos
              </button>
            )}
            {canViewAdmin && (
              <button
                id="adminTab"
                onClick={() => setActiveTab("admin")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                  activeTab === "admin"
                    ? "bg-[#123E33] text-white border-[#123E33]"
                    : "bg-white text-[#123E33] border-[#123E33]/20 hover:border-[#123E33]"
                }`}
              >
                <Users className="w-4 h-4" /> Controle de Acesso
              </button>
            )}
            {canViewAudit && (
              <button
                id="auditTab"
                onClick={() => setActiveTab("audit")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                  activeTab === "audit"
                    ? "bg-[#123E33] text-white border-[#123E33]"
                    : "bg-white text-[#123E33] border-[#123E33]/20 hover:border-[#123E33]"
                }`}
              >
                <ShieldCheck className="w-4 h-4" /> Auditoria
              </button>
            )}
          </div>
        )}

        {/* WORKSPACE VIEWS */}
        <div className="flex-1 p-4 sm:p-6 md:p-8 bg-[#FAF9F6]">
          {(selectedCondominiumId || activeTab === "admin" || activeTab === "audit") ? (
            <div className="h-full">
              {/* TABS VIEW RENDER */}
              {activeTab === "folders" && selectedCondominiumId && (
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

              {activeTab === "protocols" && selectedCondominiumId && (
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
            <div className="bg-white border border-[#123E33] p-12 text-center flex flex-col items-center justify-center min-h-[450px]">
              <div className="p-4 bg-[#EEF2F0] text-[#123E33] border border-[#123E33] mb-6">
                <Building className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-serif italic text-[#123E33]">Bem-vindo, {currentUser.name}!</h3>
              <p className="text-xs text-[#123E33] opacity-70 max-w-sm mt-3 leading-relaxed">
                Selecione um condomínio na barra lateral para acessar as pastas mensais de prestação de contas, fazer downloads de relatórios ou abrir chamados/demandas técnicas.
              </p>

              {canViewAdmin && (
                <div className="mt-8 pt-6 border-t border-[#123E33]/20 w-full max-w-sm">
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-60 mb-3">Acesso Administrativo:</p>
                  <button
                    onClick={() => {
                      setActiveTab("admin");
                    }}
                    className="border-2 border-[#123E33] text-[#123E33] hover:bg-[#123E33] hover:text-white text-[11px] uppercase font-bold tracking-widest px-6 py-2.5 transition-all cursor-pointer inline-flex items-center gap-2"
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
