
document.addEventListener('DOMContentLoaded', () => {
  const packageCards = document.querySelectorAll('.package-card');
  const selectedName = document.getElementById('selected-name');
  const selectedPrice = document.getElementById('selected-price');
  const paymentForm = document.getElementById('payment-form');
  const phoneInput = document.getElementById('phone');
  const payButton = document.getElementById('pay-button');
  const statusMessage = document.getElementById('status-message');

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

  const paymentEndpoint =
    'https://perontips-backend.onrender.com/pay';

  const statusEndpoint =
    'https://perontips-backend.onrender.com/status';

  let selectedPackage = null;
  let paymentInProgress = false;
  let pollingTimer = null;
  let paymentTimeout = null;

  // Restore the saved phone number, if available.
  const savedPhone = localStorage.getItem('sangpointPhone');
  if (savedPhone) {
    phoneInput.value = savedPhone;
  }

  // Display status messages.
  function showStatus(message, type = '') {
    statusMessage.textContent = message;

    statusMessage.classList.remove(
      'success',
      'error',
      'warning'
    );

    if (type) {
      statusMessage.classList.add(type);
    }
  }

  // Enable or disable the payment button.
  function updatePayButton() {
    payButton.disabled =
      !selectedPackage ||
      !phoneInput.value.trim() ||
      paymentInProgress;
  }

  // Select a Wi-Fi package.
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
        const isSelected = item === card;

        item.classList.toggle('selected', isSelected);
        item.setAttribute(
          'aria-pressed',
          String(isSelected)
        );
      });

      selectedName.textContent =
        `${selected.name} (${selected.duration})`;

      selectedPrice.textContent =
        `KSh ${selected.amount}`;

      showStatus(
        'Package selected. Enter your M-Pesa number to continue.'
      );

      updatePayButton();
    });
  });

  // Normalize Kenyan phone numbers for the backend.
  function normalizePhone(rawPhone) {
    let phone = rawPhone.replace(/[\s\-()]/g, '');

    if (phone.startsWith('+254')) {
      phone = phone.slice(1);
    }

    if (/^0[17]\d{8}$/.test(phone)) {
      phone = '254' + phone.slice(1);
    }

    if (/^[17]\d{8}$/.test(phone)) {
      phone = '254' + phone;
    }

    if (!/^254[17]\d{8}$/.test(phone)) {
      return null;
    }

    return phone;
  }

  phoneInput.addEventListener('input', () => {
    if (!paymentInProgress) {
      updatePayButton();
    }
  });

  // Stop checking payment status.
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

  // Finish the payment process.
  function finishPayment() {
    stopPolling();

    paymentInProgress = false;
    payButton.querySelector('span').textContent =
      'Continue to M-Pesa';

    updatePayButton();
  }

  // Check whether M-Pesa payment has been confirmed.
  function pollPaymentStatus(phone) {
    const checkStatus = async () => {
      if (!paymentInProgress) return;

      try {
        const response = await fetch(
          `${statusEndpoint}?phone=${encodeURIComponent(phone)}`
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (
          data.status === 'Success' ||
          data.status === 'success'
        ) {
          stopPolling();

          localStorage.setItem('sangpointPaid', 'true');
          localStorage.setItem(
            'sangpointPackage',
            selectedPackage.id
          );
          localStorage.setItem(
            'sangpointAmount',
            String(selectedPackage.amount)
          );

          finishPayment();

          showStatus(
            'Payment confirmed! Your payment has been verified. ' +
            'Internet access will be available once your Wi-Fi ' +
            'access system activates your session.',
            'success'
          );

          return;
        }

        if (
          data.status === 'Failed' ||
          data.status === 'Cancelled' ||
          data.status === 'Canceled' ||
          data.status === 'failed' ||
          data.status === 'cancelled' ||
          data.status === 'canceled'
        ) {
          stopPolling();
          finishPayment();

          showStatus(
            'Payment was not completed. Please try again.',
            'error'
          );
        }
      } catch (error) {
        console.error('Payment status check failed:', error);
      }
    };

    checkStatus();

    pollingTimer = setInterval(checkStatus, 3000);

    paymentTimeout = setTimeout(() => {
      if (!paymentInProgress) return;

      stopPolling();
      finishPayment();

      showStatus(
        'We could not confirm your payment in time. ' +
        'Check your M-Pesa messages before trying again. ' +
        'If you were charged, do not pay again until the ' +
        'payment status has been checked.',
        'warning'
      );
    }, 120000);
  }

  // Initiate the M-Pesa STK Push.
  paymentForm.addEventListener('submit', async event => {
    event.preventDefault();

    if (paymentInProgress) return;

    if (!selectedPackage) {
      showStatus(
        'Please select a Wi-Fi package first.',
        'error'
      );
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

    payButton.querySelector('span').textContent =
      'Sending M-Pesa prompt...';

    showStatus(
      'Please wait while we send the M-Pesa payment prompt to your phone.'
    );

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
      } catch (error) {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          'Could not initiate payment. Please try again.'
        );
      }

      if (
        data.status === 'Failed' ||
        data.status === 'Cancelled' ||
        data.status === 'Canceled' ||
        data.status === 'failed' ||
        data.status === 'cancelled' ||
        data.status === 'canceled'
      ) {
        throw new Error(
          data.message ||
          data.error ||
          'The payment request was not accepted.'
        );
      }

      payButton.querySelector('span').textContent =
        'Waiting for payment...';

      showStatus(
        'Payment request sent. Enter your M-Pesa PIN on your phone ' +
        'to approve KSh ' + selectedPackage.amount +
        '. Do not share your PIN with anyone.'
      );

      pollPaymentStatus(phone);

    } catch (error) {
      console.error('Payment initiation failed:', error);

      finishPayment();

      showStatus(
        error.message ||
        'Unable to start payment. Check your connection and try again.',
        'error'
      );
    }
  });

  // Initial page state.
  updatePayButton();
});
