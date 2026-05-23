document.addEventListener("DOMContentLoaded", () => {
  const addEntryForm = document.getElementById("add-entry-form");
  const formMessage = document.getElementById("form-message");
  const entriesContainer = document.getElementById("entries-container");

  // Summary elements
  const summaryTotalKm = document.getElementById("summary-total-km");
  const summaryTotalSpent = document.getElementById("summary-total-spent");
  const summaryAvgCost = document.getElementById("summary-avg-cost");
  const summaryFillups = document.getElementById("summary-fillups");

  // Set today's date as default
  const dateInput = document.getElementById("entry-date");
  dateInput.value = new Date().toISOString().split("T")[0];

  // Fetch and render all entries
  async function loadEntries() {
    try {
      const response = await fetch("/fuel-tracker/entries");
      if (!response.ok) throw new Error("Failed to fetch entries");
      const entries = await response.json();
      renderEntries(entries);
      renderSummary(entries);
    } catch (error) {
      entriesContainer.innerHTML =
        '<p class="error-state">Failed to load entries. Please try again.</p>';
      console.error("Error loading fuel entries:", error);
    }
  }

  // Render the summary cards
  function renderSummary(entries) {
    const totalFillups = entries.length;
    const totalSpent = entries.reduce((sum, e) => sum + e.amount, 0);

    if (totalFillups === 0) {
      summaryTotalKm.textContent = "— km";
      summaryTotalSpent.textContent = "₹ —";
      summaryAvgCost.textContent = "₹ —/km";
      summaryFillups.textContent = "—";
      return;
    }

    // The last entry (highest odometer) has total_km
    const lastEntry = entries[entries.length - 1];
    const totalKm = lastEntry.total_km || 0;

    // Collect entries with a valid range to compute average cost
    const validRangeEntries = entries.filter(
      (e) => e.range_km !== null && e.range_km > 0
    );
    const totalRangeKm = validRangeEntries.reduce(
      (sum, e) => sum + e.range_km,
      0
    );
    const avgCostPerKm =
      totalRangeKm > 0
        ? validRangeEntries.reduce((sum, e) => sum + e.amount, 0) / totalRangeKm
        : null;

    summaryTotalKm.textContent = `${totalKm.toFixed(1)} km`;
    summaryTotalSpent.textContent = `₹ ${totalSpent.toFixed(2)}`;
    summaryAvgCost.textContent =
      avgCostPerKm !== null
        ? `₹ ${avgCostPerKm.toFixed(2)}/km`
        : "₹ —/km";
    summaryFillups.textContent = totalFillups;
  }

  // Render the entries table
  function renderEntries(entries) {
    if (entries.length === 0) {
      entriesContainer.innerHTML =
        '<p class="empty-state">No entries yet. Add your first fuel entry above!</p>';
      return;
    }

    // Display newest first
    const reversed = [...entries].reverse();

    const tableHtml = `
      <div class="table-wrapper">
        <table class="entries-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount (₹)</th>
              <th>Odometer (km)</th>
              <th>Range (km)</th>
              <th>Cost / km (₹)</th>
              <th>Total km</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${reversed.map((entry) => renderEntryRow(entry)).join("")}
          </tbody>
        </table>
      </div>
    `;
    entriesContainer.innerHTML = tableHtml;

    // Attach delete listeners
    entriesContainer.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => deleteEntry(btn.dataset.id));
    });
  }

  // Render a single table row
  function renderEntryRow(entry) {
    const range =
      entry.range_km !== null ? `${entry.range_km.toFixed(1)} km` : "—";
    const costPerKm =
      entry.cost_per_km !== null ? `₹ ${entry.cost_per_km.toFixed(2)}` : "—";
    const totalKm =
      entry.total_km !== null ? `${entry.total_km.toFixed(1)} km` : "—";

    return `
      <tr>
        <td>${entry.date}</td>
        <td>₹ ${entry.amount.toFixed(2)}</td>
        <td>${entry.odometer_km.toFixed(1)}</td>
        <td class="range-cell">${range}</td>
        <td>${costPerKm}</td>
        <td>${totalKm}</td>
        <td>
          <button class="delete-btn icon-btn" data-id="${entry.id}" title="Delete entry">🗑️</button>
        </td>
      </tr>
    `;
  }

  // Add a new fuel entry
  addEntryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessage();

    const amount = parseFloat(document.getElementById("entry-amount").value);
    const odometerKm = parseFloat(
      document.getElementById("entry-odometer").value
    );
    const date = document.getElementById("entry-date").value;

    try {
      const response = await fetch("/fuel-tracker/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, odometer_km: odometerKm, date }),
      });

      if (!response.ok) {
        const err = await response.json();
        showMessage(err.detail || "Failed to add entry", "error");
        return;
      }

      showMessage("Fuel entry added successfully!", "success");
      addEntryForm.reset();
      dateInput.value = new Date().toISOString().split("T")[0];
      loadEntries();
    } catch (error) {
      showMessage("Failed to add entry. Please try again.", "error");
      console.error("Error adding fuel entry:", error);
    }
  });

  // Delete a fuel entry
  async function deleteEntry(id) {
    if (!confirm("Delete this fuel entry?")) return;

    try {
      const response = await fetch(`/fuel-tracker/entries/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const err = await response.json();
        showMessage(err.detail || "Failed to delete entry", "error");
        return;
      }
      loadEntries();
    } catch (error) {
      showMessage("Failed to delete entry. Please try again.", "error");
      console.error("Error deleting fuel entry:", error);
    }
  }

  function showMessage(text, type) {
    formMessage.textContent = text;
    formMessage.className = `message ${type}`;
    formMessage.classList.remove("hidden");
    setTimeout(() => hideMessage(), 4000);
  }

  function hideMessage() {
    formMessage.classList.add("hidden");
    formMessage.textContent = "";
    formMessage.className = "hidden message";
  }

  // Initial load
  loadEntries();
});
