document.addEventListener('DOMContentLoaded', () => {
  const contentDiv = document.getElementById('content');

  let section = parseInt(localStorage.getItem('quizSection')) || 1;
  let isRetry = localStorage.getItem('quizRetry') === 'true';
  let phone = localStorage.getItem('quizPhone') || '';

  function showSectionSelector() {
    contentDiv.innerHTML = `
      <h2 style="font-size:36px;">Select Quiz Section</h2>

      <select id="section-select"
        style="font-size:28px;width:100%;padding:12px;">
        ${Array.from({ length: 10 }, (_, i) =>
          `<option value="${i + 1}">
            Section ${String.fromCharCode(65 + i)}
          </option>`
        ).join('')}
      </select>

      <button id="go"
        style="font-size:28px;width:100%;margin-top:20px;">
        Continue
      </button>
    `;

    document.getElementById('go').onclick = () => {
      section = parseInt(document.getElementById('section-select').value);
      localStorage.setItem('quizSection', section);
      showPayment();
    };
  }

  function showPayment() {
    const amount = isRetry ? 20 : (section <= 5 ? 5 : 10);

    contentDiv.innerHTML = `
      <h2 style="font-size:36px;">
        Section ${String.fromCharCode(64 + section)}
      </h2>

      <p style="font-size:28px;">Pay Ksh ${amount}</p>

      <input id="phone" value="${phone}"
        placeholder="07XXXXXXXX"
        style="font-size:28px;width:100%;padding:12px;">

      <button id="pay"
        style="font-size:28px;width:100%;margin-top:15px;">
        Pay
      </button>

      <div id="status" style="font-size:26px;margin-top:10px;"></div>
    `;

    document.getElementById('pay').onclick = () => {
      const raw = document.getElementById('phone').value.trim();
      if (!/^07\d{8}$/.test(raw)) return alert("Invalid phone");

      localStorage.setItem('quizPhone', raw);
      localStorage.setItem('quizRetry', 'false');

      document.getElementById('status').innerText = "Processing…";

      setTimeout(() => {
        location.href = "quiz.html";
      }, 1500);
    };
  }

  showSectionSelector();
});
