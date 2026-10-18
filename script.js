
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // Existing Render server
  const API_BASE = "https://perontips-backend.onrender.com";

  // SangPoint Wi-Fi packages
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

  const packageButtons = document.querySelectorAll(".package-card");
  const selectedName = document.getElementById("selected-name");
  const selectedPrice = document.getElementById("selected-price");
  const phoneInput = document.getElementById("phone");
  const payButton = document.getElementById("pay-button");
  const paymentForm = document.getElementById("payment-form");
  const statusMessage = document.getElementById("status-message");

  let selectedPackage = null;
  let pollingTimer = null;
  let requestInProgress = false;

  function setStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "notice";

    if (type) {
      statusMessage.classList.add(type);
    }
  }

  function normalizeKenyanPhone(value) {
    let phone = value.trim().replace(/[\s()-]/g, "");

    if (phone.startsWith("+")) {
      phone = phone.substring(1);
    }

    if (/^0[17]\d{8}$/.test(phone)) {
      return "254" + phone.substring(1);
    }

    if (/^254[17]\d{8}$/.test(phone)) {
      return phone;
    }

    if (/^[17]\d{8}$/.test(phone)) {
      return "254" + phone;
    }

    return null;
  }

  function stopPolling() {
    if (pollingTimer !== null) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  }

  // Select a package
  packageButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (requestInProgress) return;

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
        "Selected " + chosen.name +
        " for KSh " + chosen.amount +
        ". Enter your M-Pesa number to continue."
      );
    });
  });

  // Request a payment
  paymentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (requestInProgress) return;

    if (!selectedPackage) {
      setStatus("Please select a package first.", "error");
      return;
    }

    const phone = normalizeKenyanPhone(phoneInput.value);

    if (!phone) {
      setStatus(
        "Enter a valid Kenyan number, such as 0712345678.",
        "error"
      );
      phoneInput.focus();
      return;
    }

    requestInProgress = true;
    payButton.disabled = true;
    phoneInput.disabled = true;

    setStatus("Connecting to the SangPoint payment service...");

    try {
      /*
       * This route must be implemented on Render first.
       * The server must validate the package ID and determine
       * the amount itself; it must not trust a browser-supplied price.
       */
      const response = await fetch(API_BASE + "/sangpoint/pay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phone: phone,
          packageId: selectedPackage.id
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success !== true) {
        throw new Error(
          data.error ||
          data.message ||
          "The SangPoint payment service is not ready or rejected the request."
        );
      }

      const checkoutId = data.checkoutId;

      if (!checkoutId) {
        throw new Error(
          "The server did not return a payment reference."
        );
      }

      setStatus(
        "M-Pesa prompt requested. Check your phone and enter your PIN only in the official M-Pesa prompt."
      );

      startPolling(checkoutId);

    } catch (error) {
      console.error("SangPoint payment request error:", error);

      setStatus(
        error.message ||
        "Unable to connect to the payment service. Please try again later.",
        "error"
      );

      requestInProgress = false;
      payButton.disabled = false;
      phoneInput.disabled = false;
    }
  });

  // Check the status of this specific payment
  function startPolling(checkoutId) {
    stopPolling();

    let attempts = 0;
    const maxAttempts = 60;

    async function checkStatus() {
      attempts++;

      try {
        const url =
          API_BASE +
          "/sangpoint/status?checkoutId=" +
          encodeURIComponent(checkoutId);

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error("Could not check payment status.");
        }

        if (data.status === "Success") {
          stopPolling();

          setStatus(
            "Payment confirmed. Your SangPoint package is being activated.",
            "success"
          );

          /*
           * The server should return accessActivated: true only
           * after it has successfully authorized the MikroTik
           * HotSpot customer session.
           */
          if (data.accessActivated === true) {
            setStatus(
              "Payment confirmed and internet access activated. Enjoy SangPoint Connect!",
              "success"
            );
          } else {
            setStatus(
              "Payment confirmed, but internet activation is still pending. Please do not pay again. Contact SangPoint support if access does not start.",
              "error"
            );
          }

          requestInProgress = false;
          phoneInput.disabled = false;
          payButton.disabled = false;
          return;
        }

        if (data.status === "Failed") {
          stopPolling();

          setStatus(
            data.resultDesc ||
            "Payment was not completed. You can try again.",
            "error"
          );

          requestInProgress = false;
          phoneInput.disabled = false;
          payButton.disabled = false;
          return;
        }

        setStatus(
          "Waiting for M-Pesa confirmation... Please check your phone. Do not submit another payment."
        );

      } catch (error) {
        console.error("SangPoint status check error:", error);

        setStatus(
          "Unable to verify the payment status right now. Please wait and do not pay again."
        );
      }

      if (attempts >= maxAttempts) {
        stopPolling();

        setStatus(
          "Automatic checking has stopped. Your payment may still be processing. Do not pay again until the transaction status is checked."
        );

        requestInProgress = false;
        phoneInput.disabled = false;
        payButton.disabled = false;
      }
    }

    checkStatus();
    pollingTimer = setInterval(checkStatus, 3000);
  }

  // Initial page state
  packageButtons.forEach((button) => {
    button.setAttribute("aria-pressed", "false");
  });

  payButton.disabled = true;

  setStatus("Choose a Wi-Fi package to continue.");
});
