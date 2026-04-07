document.addEventListener("DOMContentLoaded", () => {

    const API_BASE = "http://localhost:3000";
    const CID      = localStorage.getItem("cid") || crypto.randomUUID();
    localStorage.setItem("cid", CID);

    // ── Captcha (Simulado para frontend) ───────────────────
    function createCaptchaController({ checkId, btnId, statusId }) {
        const check  = document.getElementById(checkId);
        const btn    = document.getElementById(btnId);
        const status = document.getElementById(statusId);
        let token = null;

        function setStatus(type, text) {
            if (!status) return;
            status.className   = type;
            status.textContent = text;
            if(type === "error") status.style.color = "crimson";
            if(type === "ok") status.style.color = "#27ae60";
            if(type === "neutral") status.style.color = "inherit";
        }

        function verify() {
            if (!check?.checked) { 
                setStatus("error", "Marca la casilla antes de verificar."); 
                return; 
            }

            btn.disabled = true;
            btn.textContent = "Verificando...";
            setStatus("neutral", "Analizando comportamiento...");

            // Simulamos que el servidor está verificando (1.5 segundos)
            setTimeout(() => {
                token = "token_valido_generado";
                setStatus("ok", "Verificación completada. 👍");
                btn.textContent = "Verificado";
                check.disabled = true; // Bloqueamos la casilla
            }, 1500);
        }

        btn?.addEventListener("click", verify);

        return {
            isVerified: () => Boolean(token),
            reset() {
                token = null;
                if (check) { check.checked = false; check.disabled = false; }
                if (btn) { btn.disabled = false; btn.textContent = "Verificar"; }
                setStatus("neutral", "Marca la casilla y presiona \"Verificar\".");
            },
        };
    }

    // Inicializar los CAPTCHAs si existen en el HTML
    const captchaLogin = document.getElementById("captchaBtnLogin")
        ? createCaptchaController({ checkId: "captchaCheckLogin", btnId: "captchaBtnLogin", statusId: "captchaStatusLogin" })
        : null;

    const captchaRegister = document.getElementById("captchaBtnRegister")
        ? createCaptchaController({ checkId: "captchaCheckRegister", btnId: "captchaBtnRegister", statusId: "captchaStatusRegister" })
        : null;

    // ── Lógica del Modal MFA ───────────────────────────────
    function pedirCodigoMFA() {
        return new Promise((resolve) => {
            const modal = document.getElementById("mfa-modal");
            const input = document.getElementById("mfa-code-input");
            const btnVerify = document.getElementById("mfa-verify-btn");
            const btnCancel = document.getElementById("mfa-cancel-btn");
            
            modal.style.display = "flex";
            input.value = "";
            input.focus();

            const cleanup = () => {
                modal.style.display = "none";
                btnVerify.removeEventListener("click", onVerify);
                btnCancel.removeEventListener("click", onCancel);
            };

            const onVerify = () => { cleanup(); resolve(input.value.trim()); };
            const onCancel = () => { cleanup(); resolve(null); };

            btnVerify.addEventListener("click", onVerify);
            btnCancel.addEventListener("click", onCancel);
        });
    }

    // ── Validación HTML5 personalizada ─────────────────────
    function focusFirstInvalid(form) {
        form.querySelector(":invalid")?.focus({ preventScroll: true });
    }

    function attachCustomMessages(form) {
        form.addEventListener("invalid", e => {
            const el = e.target;
            el.setCustomValidity("");
            if      (el.validity.valueMissing)    el.setCustomValidity("Este campo es obligatorio.");
            else if (el.validity.typeMismatch)    el.setCustomValidity("Formato no válido.");
            else if (el.validity.patternMismatch) el.setCustomValidity(el.getAttribute("title") || "Formato no válido.");
            else if (el.validity.tooShort)        el.setCustomValidity(`Mínimo ${el.getAttribute("minlength")} caracteres.`);
        }, true);
        form.addEventListener("input", e => e.target.setCustomValidity(""));
    }

    // ── Confirmar contraseña ───────────────────────────────
    const pass    = document.getElementById("password-register");
    const confirm = document.getElementById("password-confirm");
    if (pass && confirm) {
        const checkMatch = () => {
            confirm.setCustomValidity(
                pass.value && confirm.value && pass.value !== confirm.value
                    ? "Las contraseñas no coinciden."
                    : ""
            );
        };
        pass.addEventListener("input", checkMatch);
        confirm.addEventListener("input", checkMatch);
    }

    const forms = ["form-login", "form-register", "form-busqueda"]
        .map(id => document.getElementById(id))
        .filter(Boolean);

    // ── Llamadas al backend ────────────────────────────────
    async function enviarLogin({ email, password }) {
        const headers = { "Content-Type": "application/json" };
        const res  = await (window._log?.fetch || fetch)(`${API_BASE}/auth/login`, {
            method: "POST", headers, body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Error en el login");
        return data;
    }

    async function enviarRegistro({ email, password, confirm }) {
        const headers = { "Content-Type": "application/json" };
        const res  = await (window._log?.fetch || fetch)(`${API_BASE}/auth/registro`, {
            method: "POST", headers, body: JSON.stringify({ email, password, confirm }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Error en el registro");
        return data;
    }

    function getMsgEl(id, form) {
        let el = document.getElementById(id);
        if (!el) {
            el = Object.assign(document.createElement("p"), { id, role: "status" });
            el.style.marginTop = "8px";
            form.appendChild(el);
        }
        return el;
    }

    // ── Submit de formularios ──────────────────────────────
    forms.forEach(form => {
        attachCustomMessages(form);

        form.addEventListener("submit", async e => {
            e.preventDefault();
            if (!form.checkValidity()) { focusFirstInvalid(form); return; }

            const isLogin    = form.id === "form-login";
            const isRegister = form.id === "form-register";

            //  BLOQUEO DEL CAPTCHA
            if (isLogin && captchaLogin && !captchaLogin.isVerified()) {
                const msgEl = getMsgEl("loginMsg", form);
                msgEl.style.color = "crimson";
                msgEl.textContent = "⚠️ Por favor, verifica que no eres un robot.";
                return; 
            }

            if (isRegister && captchaRegister && !captchaRegister.isVerified()) {
                const msgEl = getMsgEl("registroMsg", form);
                msgEl.style.color = "crimson";
                msgEl.textContent = "⚠️ Por favor, verifica que no eres un robot.";
                return; 
            }
            // --------------------------------

            try {
                if (isLogin) {
                    const msgEl = getMsgEl("loginMsg", form);
                    msgEl.style.color = "inherit";
                    msgEl.textContent = "Verificando…";
                    
                    const res = await enviarLogin({
                        email:    form.elements.email.value.trim(),
                        password: form.elements.password.value,
                    });

                    // 1. ¿Pide MFA?
                    if (res.mfa_required) {
                        msgEl.style.color = "#3498db";
                        msgEl.textContent = res.mensaje;
                        
                        const codigo = await pedirCodigoMFA();
                        
                        if (codigo) {
                            msgEl.style.color = "inherit";
                            msgEl.textContent = "Verificando código...";

                            const mfaRes = await fetch(`${API_BASE}/auth/mfa/verificar`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ user_id: res.user_id, codigo })
                            }).then(r => r.json());
                            
                            if (mfaRes.access_token) {
                                window.SSO.guardarSesion(mfaRes);
                                msgEl.style.color = "green";
                                msgEl.textContent = "Autenticación MFA exitosa.";
                                setTimeout(() => window.location.reload(), 1000);
                            } else {
                                throw new Error(mfaRes.error || "Código MFA inválido");
                            }
                        } else {
                            msgEl.style.color = "crimson";
                            msgEl.textContent = "Autenticación cancelada.";
                        }
                        return;
                    }

                    // 2. Login normal
                    msgEl.style.color = "green";
                    msgEl.textContent = res?.mensaje || "Inicio de sesión correcto.";
                    
                    if (res.access_token) {
                        window.SSO.guardarSesion(res); 
                        setTimeout(() => {
                            const params = new URLSearchParams(location.search);
                            if (params.get("sso_redirect")) window.SSO.manejarRedirectPostLogin();
                            else window.location.reload(); 
                        }, 1000);
                    }

                } else if (isRegister) {
                    const msgEl = getMsgEl("registroMsg", form);
                    msgEl.style.color = "inherit";
                    msgEl.textContent = "Creando cuenta…";
                    const res = await enviarRegistro({
                        email:    form.elements.email.value.trim(),
                        password: form.elements.password.value,
                        confirm:  form.elements.confirm.value,
                    });
                    msgEl.style.color = "green";
                    msgEl.textContent = res?.mensaje || "Usuario registrado correctamente.";
                    form.reset();
                    if (captchaRegister) captchaRegister.reset(); // Reiniciar captcha tras registro
                }

            } catch (err) {
                const msgEl = getMsgEl(isLogin ? "loginMsg" : "registroMsg", form);
                msgEl.style.color = "crimson";
                msgEl.textContent = err.message;
            }
        });
    });
});

(function checkAuthState() {
    const token  = localStorage.getItem("access_token");
    const panel  = document.getElementById("settings-panel");
    const cuenta = document.querySelector("section.cuenta");

    if (token && panel) {
        panel.style.display = "block";
        if (cuenta) cuenta.style.display = "none";
    }
})();