
document.addEventListener('DOMContentLoaded', () => {
  const packageCards = document.querySelectorAll('.package-card');
  const selectedName = document.getElementById('selected-name');
  const selectedPrice = document.getElementById('selected-price');
  const paymentForm = document.getElementById('payment-form');
  const phoneInput = document.getElementById('phone');
  const payButton = document.getElementById('pay-button');
  const statusMessage = document.getElementById('status-message');

  const API_BASE = 'https://perontips-backend.onrender.com';
  const paymentEndpoint = `${API_BASE}/pay`;
  const statusEndpoint = `${API_BASE}/status`;

  const packages = {
    'hour': {
      name: 'Hourly Package',
      amount: 5,
      duration: '1 hour'
    },
    'ten-hours': {
      name: '10-Hour Package',
      amount: 20,
      duration: '10 hours'
    },
    'five-days': {
      name: '5-Day Package',
      amount: 100,
      duration: '5 days'
    },
    'six-days': {
      name: '6-Day Package',
      amount: 120,
      duration: '6 days'
    }
  };

  let selectedPackage = null;
  let paymentInProgress = false;
  let pollingTimer = null;
  let paymentTimeout = null;

  const savedPhone = localStorage.getItem('sangpointPhone');
  if (savedPhone) {
    phoneInput.value = savedPhone;
  }

  function showStatus(message, type = '') {
    statusMessage.textContent = message;
    statusMessage.classList.remove('success', 'error', 'warning');

    if (type) {
      statusMessage.classList.add(type);
    }
  }

  function updatePayButton() {
    payButton.disabled =
      !selectedPackage ||
      !phoneInput.value.trim() ||
      paymentInProgress;
  }

  packageCards.forEach(card => {
    card.addEventListener('click', () => {
      if (paymentInProgress) return;

      const packageId = card.dataset.package;
      const selected = packages[packageId];

      if (!selected) {
        showStatus('This package is unavailable.', 'error');
        return;
      }

      selectedPackage = {
        id: packageId,
        ...selected
      };

      packageCards.forEach(item => {
        const active = item === card;
        item.classList.toggle('selected', active);
        item.setAttribute('aria-pressed', String(active));
      });

      selectedName.textContent =
        `${selected.name} (${selected.duration})`;

      selectedPrice.textContent = `KSh ${selected.amount}`;

      showStatus(
        'Package selected. Enter your M-Pesa number to continue.'
      );

      updatePayButton();
    });
  });

  function normalizePhone(rawPhone) {
    let phone = rawPhone.replace(/[\s\-()]/g, '');

    if (phone.startsWith('+254')) {
      phone = phone.slice(1);
    }

    if (/^0[17]\d{8}$/.test(phone)) {
      phone = '254' + phone.slice(1);
    } else if (/^[17]\d{8}$/.test(phone)) {
      phone = '254' + phone;
    }

    return /^254[17]\d{8}$/.test(phone) ? phone : null;
  }

  phoneInput.addEventListener('input', () => {
    if (!paymentInProgress) updatePayButton();
  });

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }

    if (paymentTimeout) {
      clearTimeout(paymentTimeout);
      paymentTimeout = null;
    }
  }

  function finishPayment() {
    stopPolling();
    paymentInProgress = false;

    const buttonText = payButton.querySelector('span');
    if (buttonText) buttonText.textContent = 'Continue to M-Pesa';
    else payButton.textContent = 'Continue to M-Pesa';

    updatePayButton();
  }

  function pollPaymentStatus(phone) {
    let checking = false;

    async function checkStatus() {
      if (!paymentInProgress || checking) return;
      checking = true;

      try {
        const response = await fetch(
          `${statusEndpoint}?phone=${encodeURIComponent(phone)}`
        );

        if (!response.ok) {
          throw new Error(`Status check failed (${response.status}).`);
        }

        const data = await response.json();

        if (data.status === 'Success' || data.status === 'success') {
          stopPolling();

          localStorage.setItem('sangpointPaid', 'true');
          localStorage.setItem('sangpointPackage', selectedPackage.id);
          localStorage.setItem(
            'sangpointAmount',
            String(selectedPackage.amount)
          );

          finishPayment();

          showStatus(
            'Payment confirmed! Your M-Pesa payment was verified. ' +
            'Wi-Fi access will start once the Wi-Fi access system ' +
            'activates your session.',
            'success'
          );
        } else if (
          ['Failed', 'Cancelled', 'Canceled', 'failed',
           'cancelled', 'canceled'].includes(data.status)
        ) {
          finishPayment();

          showStatus(
            'Payment was not completed. Please try again.',
            'error'
          );
        }
      } catch (error) {
        console.error('Payment status check failed:', error);
      } finally {
        checking = false;
      }
    }

    checkStatus();
    pollingTimer = setInterval(checkStatus, 3000);

    paymentTimeout = setTimeout(() => {
      if (!paymentInProgress) return;

      finishPayment();

      showStatus(
        'We could not confirm your payment in time. Check your M-Pesa ' +
        'messages before trying again. If you were charged, do not pay ' +
        'again until the transaction has been checked.',
        'warning'
      );
    }, 120000);
  }

  paymentForm.addEventListener('submit', async event => {
    event.preventDefault();

    if (paymentInProgress) return;

    if (!selectedPackage) {
      showStatus('Please select a Wi-Fi package first.', 'error');
      return;
    }

    const phone = normalizePhone(phoneInput.value.trim());

    if (!phone) {
      showStatus(
        'Enter a valid Kenyan number, such as 0712345678 or 0112345678.',
        'error'
      );
      phoneInput.focus();
      return;
    }

    localStorage.setItem('sangpointPhone', phoneInput.value.trim());

    paymentInProgress = true;
    updatePayButton();

    const buttonText = payButton.querySelector('span');
    if (buttonText) buttonText.textContent = 'Sending M-Pesa prompt...';
    else payButton.textContent = 'Sending M-Pesa prompt...';

    showStatus('Connecting to the payment service. Please wait...');

    try {
      const response = await fetch(paymentEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: phone,
          amount: selectedPackage.amount
        })
      });

      let data = {};
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          `Payment request failed (${response.status}).`
        );
      }

      if (data.success === false ||
          ['Failed', 'Cancelled', 'Canceled', 'failed',
           'cancelled', 'canceled'].includes(data.status)) {
        throw new Error(
          data.message ||
          data.error ||
          'The payment service rejected the request.'
        );
      }

      const buttonTextAfter = payButton.querySelector('span');
      if (buttonTextAfter) {
        buttonTextAfter.textContent = 'Waiting for payment...';
      } else {
        payButton.textContent = 'Waiting for payment...';
      }

      showStatus(
        'The server accepted the request. If the M-Pesa prompt arrives, ' +
        'enter your PIN to approve KSh ' + selectedPackage.amount + '.'
      );

      pollPaymentStatus(phone);

    } catch (error) {
      console.error('Payment initiation failed:', error);
      finishPayment();

      showStatus(
        error.message ||
        'Unable to start payment. Please check your connection.',
        'error'
      );
    }
  });

  updatePayButton();
});
