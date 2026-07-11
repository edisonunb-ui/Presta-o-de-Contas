import { collection, getDocs, doc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";

export async function seedDatabaseIfEmpty() {
  try {
    const usersCol = collection(db, "usuarios");
    const usersSnapshot = await getDocs(usersCol);
    
    // Garantir que edisonunb@gmail.com como SuperADM sempre exista e tenha a senha correta
    const edisonDoc = usersSnapshot.docs.find(
      doc => doc.data().email?.toLowerCase() === "edisonunb@gmail.com"
    );
    
    if (!edisonDoc) {
      const userSuperId = "user_super_adm";
      await setDoc(doc(db, "usuarios", userSuperId), {
        id: userSuperId,
        email: "edisonunb@gmail.com",
        password: "123456",
        name: "Edison Nunes (Gestor Condominial)",
        role: "SuperADM",
        firstAccess: false,
        createdAt: new Date().toISOString()
      });
      console.log("SuperADM edisonunb@gmail.com criado com sucesso com senha 123456!");
    } else {
      const currentData = edisonDoc.data();
      const updates: any = {};
      // Se a senha for "123mudar" (senha antiga), atualizamos para "123456" conforme pedido do usuário
      if (currentData.password === "123mudar") {
        updates.password = "123456";
        updates.firstAccess = false;
      }
      if (currentData.name === "Edison Nunes (SuperADM)" || !currentData.name) {
        updates.name = "Edison Nunes (Gestor Condominial)";
      }
      if (Object.keys(updates).length > 0) {
        await setDoc(doc(db, "usuarios", edisonDoc.id), updates, { merge: true });
        console.log("Edison user updated in db with friendly name/password:", updates);
      }
    }

    if (!usersSnapshot.empty) {
      console.log("Database already initialized, skipping seed.");
      return;
    }

    console.log("Seeding initial data...");
    const batch = writeBatch(db);

    // 1. Create Administradoras
    const admAlphaId = "adm_alpha_id";
    const admBetaId = "adm_beta_id";

    const alphaAdmRef = doc(db, "administradoras", admAlphaId);
    batch.set(alphaAdmRef, {
      id: admAlphaId,
      name: "Alpha Administradora Ltda",
      createdAt: new Date().toISOString()
    });

    const betaAdmRef = doc(db, "administradoras", admBetaId);
    batch.set(betaAdmRef, {
      id: admBetaId,
      name: "Beta Gestão Patrimonial",
      createdAt: new Date().toISOString()
    });

    // 2. Create Condominiums
    const condAlphaGardenId = "cond_alpha_garden";
    const condBellaVistaId = "cond_bella_vista";
    const condBetaSunsetId = "cond_beta_sunset";

    const gardenRef = doc(db, "condominios", condAlphaGardenId);
    batch.set(gardenRef, {
      id: condAlphaGardenId,
      name: "Residencial Alpha Garden",
      administradoraId: admAlphaId,
      createdAt: new Date().toISOString()
    });

    const bellaRef = doc(db, "condominios", condBellaVistaId);
    batch.set(bellaRef, {
      id: condBellaVistaId,
      name: "Condomínio Bella Vista",
      administradoraId: admAlphaId,
      createdAt: new Date().toISOString()
    });

    const sunsetRef = doc(db, "condominios", condBetaSunsetId);
    batch.set(sunsetRef, {
      id: condBetaSunsetId,
      name: "Edifício Sunset Towers",
      administradoraId: admBetaId,
      createdAt: new Date().toISOString()
    });

    // 3. Create Users
    // SuperADM - Edison Nunes
    const seedSuperId = "user_super_adm";
    const superRef = doc(db, "usuarios", seedSuperId);
    batch.set(superRef, {
      id: seedSuperId,
      email: "edisonunb@gmail.com",
      password: "123456",
      name: "Edison Nunes (Gestor Condominial)",
      role: "SuperADM",
      firstAccess: false,
      createdAt: new Date().toISOString()
    });

    // Administrador for Alpha
    const userAdmAlphaId = "user_adm_alpha";
    const admAlphaRef = doc(db, "usuarios", userAdmAlphaId);
    batch.set(admAlphaRef, {
      id: userAdmAlphaId,
      email: "adm.alpha@portal.local",
      password: "adm123",
      name: "Ricardo Ramos (Administrador Alpha)",
      role: "Administrador",
      administradoraId: admAlphaId,
      createdAt: new Date().toISOString()
    });

    // Síndico for Alpha Garden (only has access to Alpha Garden)
    const userSindicoAlphaId = "user_sindico_alpha";
    const sindicoAlphaRef = doc(db, "usuarios", userSindicoAlphaId);
    batch.set(sindicoAlphaRef, {
      id: userSindicoAlphaId,
      email: "sindico.alpha@portal.local",
      password: "sindico123",
      name: "Carlos Silva (Síndico Alpha Garden)",
      role: "Sindico",
      administradoraId: admAlphaId,
      condominiumIds: [condAlphaGardenId],
      createdAt: new Date().toISOString()
    });

    // 4. Create sample monthly folders for Alpha Garden
    const folderMayId = "folder_may_2026";
    const folderJuneId = "folder_june_2026";

    const folderMayRef = doc(db, "pastas", folderMayId);
    batch.set(folderMayRef, {
      id: folderMayId,
      condominiumId: condAlphaGardenId,
      year: 2026,
      month: 5,
      createdAt: new Date(2026, 4, 31).toISOString()
    });

    const folderJuneRef = doc(db, "pastas", folderJuneId);
    batch.set(folderJuneRef, {
      id: folderJuneId,
      condominiumId: condAlphaGardenId,
      year: 2026,
      month: 6,
      createdAt: new Date(2026, 5, 30).toISOString()
    });

    // 5. Create mock files (PDF content simulated with Base64 placeholder or brief text)
    const fileMayId = "file_may_1";
    const fileJuneId = "file_june_1";

    const fileMayRef = doc(db, "arquivos", fileMayId);
    batch.set(fileMayRef, {
      id: fileMayId,
      folderId: folderMayId,
      name: "Pasta_Contas_Maio_2026.pdf",
      size: 1542000,
      type: "application/pdf",
      uploadedBy: "Ricardo Ramos",
      uploadedAt: new Date(2026, 5, 2).toISOString(),
      content: "JVBERi0xLjQKJVRlc3QgUERGIGNvbnRlbnQgZm9yIE1heSAyMDI2LiBQcmVzdGFjYW8gZGUgQ29udGFzIGZ1bGx5IGZ1bmN0aW9uYWwu"
    });

    const fileJuneRef = doc(db, "arquivos", fileJuneId);
    batch.set(fileJuneRef, {
      id: fileJuneId,
      folderId: folderJuneId,
      name: "Relatorio_Mensal_Junho_2026.pdf",
      size: 1210400,
      type: "application/pdf",
      uploadedBy: "Ricardo Ramos",
      uploadedAt: new Date(2026, 6, 3).toISOString(),
      content: "JVBERi0xLjQKJVRlc3QgUERGIGNvbnRlbnQgZm9yIEp1bmUgMjAyNi4gUHJlc3RhY2FvIGRlIENvbnRhcyBmdWxseSBmdW5jdGlvbmFsLg=="
    });

    // 6. Create initial Sample Protocol
    const protocolId = "proto_sample_1";
    const protocolRef = doc(db, "protocolos", protocolId);
    batch.set(protocolRef, {
      id: protocolId,
      condominiumId: condAlphaGardenId,
      subject: "Dúvida sobre taxa extra de manutenção do elevador",
      description: "Olá, gostaria de verificar o detalhamento dos custos extras cobrados na pasta de Maio ref. à manutenção do elevador social do bloco B.",
      direction: "sindico_para_administradora",
      priority: "alta",
      status: "respondido",
      createdAt: new Date(2026, 5, 10).toISOString()
    });

    // Messages inside protocol
    const msg1Id = "msg_1";
    const msg1Ref = doc(db, "mensagens", msg1Id);
    batch.set(msg1Ref, {
      id: msg1Id,
      protocolId: protocolId,
      senderName: "Carlos Silva",
      senderRole: "Sindico",
      message: "Olá, gostaria de verificar o detalhamento dos custos extras cobrados na pasta de Maio ref. à manutenção do elevador social do bloco B.",
      createdAt: new Date(2026, 5, 10).toISOString()
    });

    const msg2Id = "msg_2";
    const msg2Ref = doc(db, "mensagens", msg2Id);
    batch.set(msg2Ref, {
      id: msg2Id,
      protocolId: protocolId,
      senderName: "Ricardo Ramos",
      senderRole: "Administrador",
      message: "Prezado Carlos, anexei na pasta de Maio o boleto original e o detalhamento técnico emitido pela Elevadores Otis S.A. que descreve a substituição do cabo de tração. Por favor consulte a página 14 do PDF da pasta.",
      createdAt: new Date(2026, 5, 11).toISOString()
    });

    // 7. Create initial Audit log
    const auditId = "audit_sample_1";
    const auditRef = doc(db, "auditoria", auditId);
    batch.set(auditRef, {
      id: auditId,
      userId: "user_adm_alpha",
      userName: "Ricardo Ramos",
      userRole: "Administrador",
      action: "Upload de arquivo",
      details: "Enviado arquivo Pasta_Contas_Maio_2026.pdf para a pasta Maio/2026",
      createdAt: new Date(2026, 5, 2).toISOString()
    });

    await batch.commit();
    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database: ", error);
  }
}
