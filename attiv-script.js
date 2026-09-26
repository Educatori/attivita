/* Attività Campus — script.js */

const WEB_APP_URL = 'https://script.google.com/a/macros/mail.scuole.vda.it/s/AKfycbwNo1UEbUwKCm_uSpdzAmA_vPy-6aB8KcgizyS8d_jZ33IbHL5kV0wZ3myDhmVktRk6Ug/exec';

// ============ OROLOGIO ============
function startClock() {
    const clockEl = document.getElementById('digitalClock');
    const dateEl  = document.getElementById('todayDate');
    if (!clockEl && !dateEl) return;
    const tick = () => {
        const d = new Date();
        if (clockEl) clockEl.textContent = d.toLocaleTimeString('it-IT',
            { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        if (dateEl)  dateEl.textContent  = d.toLocaleDateString('it-IT',
            { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    };
    tick();
    setInterval(tick, 1000);
}

// ============ UTILITY ============
function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, function(c) {
        return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
}

// ============ ATTIVITÀ + STATISTICHE ============
async function caricaAttivita() {
    const container = document.getElementById('dayContainer');
    if (!container) return;

    try {
        // 1) Chiedi attività e statistiche in parallelo
        const [actRes, statRes] = await Promise.all([
            fetch(WEB_APP_URL + '?action=get_activities'),
            fetch(WEB_APP_URL + '?action=stats')
        ]);
        const actData  = await actRes.json();
        const statData = await statRes.json();

        const activities = actData.activities || [];
        if (activities.length === 0) {
            container.innerHTML = '<p style="color:var(--text-2);">Nessuna attività disponibile.</p>';
            return;
        }

        // 2) Genera le card
        container.innerHTML = activities.map(function(a) {
            const s = statData[a.id] || { yes: 0, no: 0 };
            return `
                <div class="day-card">
                    <h2>${escapeHtml(a.giorno)}</h2>
                    <div class="activity">
                        <h3>${escapeHtml(a.nome)}</h3>
                        <p class="time">${escapeHtml(a.ora)} — ${escapeHtml(a.luogo)}</p>
                        <p>${escapeHtml(a.descrizione)}</p>
                        <div class="participation">
                            <strong>Partecipanti:</strong>
                            <span class="yes">${s.yes} SÌ</span>
                            <span class="no">${s.no} NO</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Errore caricamento attività:', err);
        container.innerHTML = '<p style="color:var(--absent);">Errore nel caricamento delle attività.</p>';
    }
}

// ============ FORM ISCRIZIONE ============
async function initForm() {
    const form = document.getElementById('subscriptionForm');
    if (!form) return;

    const messageElement = document.getElementById('message');
    const activitySelect = document.getElementById('activity');

    function mostraMessaggio(testo, tipo) {
        messageElement.textContent = testo;
        messageElement.className = 'message ' + tipo;
        messageElement.style.display = 'block';
    }

    // Popola il select delle attività dal Web App
    try {
        const res = await fetch(WEB_APP_URL + '?action=get_activities');
        const data = await res.json();
        const activities = data.activities || [];
        activitySelect.innerHTML = '<option value="">Scegli...</option>' +
            activities.map(a =>
                `<option value="${escapeHtml(a.id)}">${escapeHtml(a.giorno)} ${escapeHtml(a.ora)} - ${escapeHtml(a.nome)}</option>`
            ).join('');
    } catch (err) {
        console.error('Errore caricamento attività nel form:', err);
    }

    // Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const activity = activitySelect.value;
        const participation = document.getElementById('participation').value;

        if (!email || !activity || !participation) {
            mostraMessaggio('Compila tutti i campi!', 'error');
            return;
        }

        try {
            const checkRes = await fetch(WEB_APP_URL + '?action=check_email&email=' + encodeURIComponent(email));
            const checkData = await checkRes.json();
            if (!checkData.isAuthorized) {
                mostraMessaggio('Email non autorizzata!', 'error');
                return;
            }

            const body = new URLSearchParams({
                action: 'save_subscription',
                email: email,
                activity: activity,
                participation: participation
            });
            const saveRes = await fetch(WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
            });
            const saveData = await saveRes.json();

            if (saveData.success) {
                mostraMessaggio('Iscrizione confermata!', 'success');
                form.reset();
            } else {
                mostraMessaggio(saveData.error || 'Errore nel salvataggio.', 'error');
            }
        } catch (err) {
            mostraMessaggio("Errore durante l'iscrizione.", 'error');
            console.error(err);
        }
    });
}

// ============ BOOT ============
document.addEventListener('DOMContentLoaded', () => {
    startClock();
    caricaAttivita();
    initForm();
});
