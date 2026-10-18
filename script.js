document.addEventListener('DOMContentLoaded', async () => {
  let section = parseInt(localStorage.getItem('quizSection')) || 1;
  let isRetry = localStorage.getItem('quizRetry') === 'true';
  let phone = localStorage.getItem('quizPhone') || '';
  const contentDiv = document.getElementById('content');

  async function getAmountFromSheet(section) {
    try {
      const sheetURL =
        'https://docs.google.com/spreadsheets/d/1Ce3AZo4boaU91Enar8EwHN10ep9_lqHgHewSXHA0avo/gviz/tq?sheet=sheet1&tqx=out:json';
      const res = await fetch(sheetURL);
      const text = await res.text();
      const json = JSON.parse(text.substr(47).slice(0, -2));
      const rows = json.table.rows;
      if (!rows || !rows.length) return 5;

      const colStart = (section - 1) * 5;
      const amount = parseInt(rows[0].c[colStart + 3]?.v) || 5;
      return amount;
    } catch (err) {
      console.error(err);
      return 5;
    }
  }

  function showSectionSelector() {
    contentDiv.innerHTML = `
      <h2 style="font-size:26px;">Select Quiz Section</h2>
      <select id="section-select" style="width:100%; padding:20px; font-size:22px; margin-bottom:20px;">
        ${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">Section ${String.fromCharCode(65 + i)}</option>`).join('')}
      </select>
      <button id="select-btn" style="width:100%; padding:20px; font-size:22px; background:#2ecc71; color:white; border:none; border-radius:6px; cursor:pointer;">Continue</button>
    `;

    document.getElementById('select-btn').onclick = () => {
      section = parseInt(document.getElementById('section-select').value);
      localStorage.setItem('quizSection', section);
      showPayment();
    };
  }

  async function showPayment() {
    const amount = await getAmountFromSheet(section);
    contentDiv.innerHTML = `
      <h2>Section ${String.fromCharCode(64 + section)}</h2>
      <p><b>Amount:</b> Ksh ${amount}</p>
      <input id="phone-input" placeholder="07XXXXXXXX" value="${phone}" style="width:100%; padding:22px; font-size:22px; margin-bottom:15px;">
      <button id="pay-btn" style="width:100%; padding:22px; font-size:22px; background:#27ae60; color:white; border:none; border-radius:6px; cursor:pointer;">Pay Now</button>
      <div id="payment-status" style="margin-top:15px; font-size:18px;"></div>
    `;
    document.getElementById('pay-btn').onclick = initiatePayment.bind(null, amount);
  }

  async function initiatePayment(amount) {
    const raw = document.getElementById('phone-input').value.trim();
    if (!raw) return alert('Enter phone number');
    phone = raw.startsWith('07') ? '254' + raw.slice(1) : raw;
    localStorage.setItem('quizPhone', raw);

    showLoader("Wait… enter M-Pesa PIN on your phone");

    await fetch('https://perontips-backend.onrender.com/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, amount })
    });

    pollPaymentStatus();
  }

  function pollPaymentStatus() {
    const interval = setInterval(async () => {
      const res = await fetch(`https://perontips-backend.onrender.com/status?phone=${phone}`);
      const data = await res.json();
      if (data.status === 'Success') {
        clearInterval(interval);
        localStorage.setItem('quizPaid', 'true');
        localStorage.setItem('quizExpiry', Date.now() + 24*60*60*1000);
        showLoader("Payment confirmed! Don’t leave this page. Redirecting...");
        setTimeout(() => window.location.href='quiz.html', 3000);
      }
    }, 3000);
  }

  window.showLoader = function(message="Processing payment...") {
    contentDiv.innerHTML = `
      <div style="text-align:center; padding:40px;">
        <img src="16cc5661a9b0e90_file_00000000862461f9aa3ca12f21fda879_wm.png" style="width:80px; animation:spin 2s linear infinite;">
        <p id="loader-text" style="margin-top:20px; font-size:18px; font-weight:bold;">${message}</p>
      </div>
      <style>
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      </style>
    `;

    const loaderMessages = [
      "Wait… enter M-Pesa PIN on your phone",
      "Confirming payment…",
      "Payment received",
      "Don’t leave this page",
      "Redirecting you to questions…"
    ];

    let msgIndex=0, charIndex=0;
    if (window.typingTimer) clearInterval(window.typingTimer);

    function typeMessage() {
      const textEl = document.getElementById('loader-text');
      const message = loaderMessages[msgIndex];
      if (charIndex <= message.length) {
        textEl.innerHTML = message.substring(0,charIndex)+'<span class="cursor">|</span>';
        charIndex++;
      } else {
        setTimeout(()=>{charIndex=0; msgIndex=(msgIndex+1)%loaderMessages.length;},1200);
      }
    }
    window.typingTimer = setInterval(typeMessage,80);
  }

  showSectionSelector();
});
