
/*
 * SangPoint Connect frontend.
 * Payment integration is not active yet.
 * Do not use the existing Peron Tips /pay route for Wi-Fi payments.
 */

const PACKAGES = {
  "hour": {
    id: "hour",
    name: "1 hour",
    amount: 5
  },
  "ten-hours": {
    id: "ten-hours",
    name: "10 hours",
    amount: 20
  },
  "five-days": {
    id: "five-days",
    name: "5 days",
    amount: 100
  },
  "six-days": {
    id: "six-days",
    name: "6 days",
    amount: 120
  }
};

let selectedPackage = null;

const packageButtons = document.querySelectorAll(".package-card");
const selectedName = document.getElementById("selected-name");
const selectedPrice = document.getElementById("selected-price");
const phoneInput = document.getElementById("phone");
const payButton = document.getElementById("pay-button");
const statusMessage = document.getElementById("status-message");
const paymentForm = document.getElementById("payment-form");

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.className = isError
    ? "notice error"
    : "notice";
}

function normalizeKenyanPhone(raw) {
  const digits = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");

  if (/^0[17]\d{8}$/.test(digits)) {
    return "254" + digits.slice(1);
  }

  if (/^254[17]\d{8}$/.test(digits)) {
    return digits;
  }

  if (/^[17]\d{8}$/.test(digits)) {
    return "254" + digits;
  }

  return null;
}

packageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const chosen = PACKAGES[button.dataset.package];

    if (!chosen) return;

    selectedPackage = chosen;

    packageButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("selected", active);
      item.setAttribute("aria-pressed", String(active));
    });

    selectedName.textContent = chosen.name;
    selectedPrice.textContent = "KSh " + chosen.amount;
    payButton.disabled = false;

    setStatus(
      "Package selected. Enter your M-Pesa number to continue."
    );
  });
});

paymentForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!selectedPackage) {
    setStatus("Please select a package first.", true);
    return;
  }

  const phone = normalizeKenyanPhone(phoneInput.value.trim());

  if (!phone) {
    setStatus(
      "Enter a valid Kenyan mobile number, e.g. 0712345678 or 0112345678.",
      true
    );
    phoneInput.focus();
    return;
  }

  /*
   * Payment is deliberately not initiated yet.
   *
   * Next, we will connect this page to separate SangPoint endpoints
   * on Render. The backend must:
   * 1. Determine the price from the package ID.
   * 2. Initiate the STK Push.
   * 3. Verify Safaricom's payment callback.
   * 4. Prevent duplicate payment/access processing.
   * 5. Authorize the customer's MikroTik HotSpot session.
   *
   * Never trust browser-side payment success and never put Daraja
   * consumer secrets or passkeys in frontend files.
   */

  setStatus(
    "Your package is KSh " + selectedPackage.amount +
    " for " + selectedPackage.name +
    ". M-Pesa is not connected yet. The SangPoint backend and " +
    "MikroTik access integration must be configured first.",
    true
  );
});
