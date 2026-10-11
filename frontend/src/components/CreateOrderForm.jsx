import { useState } from "react";
import { X, PackagePlus } from "lucide-react";

const INITIAL_FORM = {
  customerId: "",
  pickupLatitude: "12.9700",
  pickupLongitude: "77.5900",
  deliveryLatitude: "12.9800",
  deliveryLongitude: "77.6000",
  priority: "NORMAL",
};

export default function CreateOrderForm({ onClose, onSubmit, submitting }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState("");

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function validate() {
    if (!form.customerId.trim()) {
      return "Customer ID is required.";
    }

    const coordinateFields = [
      ["Pickup latitude", form.pickupLatitude, -90, 90],
      ["Pickup longitude", form.pickupLongitude, -180, 180],
      ["Delivery latitude", form.deliveryLatitude, -90, 90],
      ["Delivery longitude", form.deliveryLongitude, -180, 180],
    ];

    for (const [label, value, min, max] of coordinateFields) {
      const number = Number(value);

      if (value.trim() === "" || !Number.isFinite(number)) {
        return `${label} must be a valid number.`;
      }

      if (number < min || number > max) {
        return `${label} must be between ${min} and ${max}.`;
      }
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationError = validate();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError("");

    const payload = {
      customerId: form.customerId.trim(),
      pickupLatitude: Number(form.pickupLatitude),
      pickupLongitude: Number(form.pickupLongitude),
      deliveryLatitude: Number(form.deliveryLatitude),
      deliveryLongitude: Number(form.deliveryLongitude),
      priority: form.priority,
    };

    try {
      await onSubmit(payload);
    } catch (error) {
      setFormError(error.message || "Could not create the order.");
    }
  }

  return (
    <section className="panel create-order-panel">
      <div className="panel-header">
        <div className="create-order-heading">
          <div className="create-order-icon">
            <PackagePlus size={20} />
          </div>
          <div>
            <h3>Create delivery order</h3>
            <p>Enter the pickup and delivery coordinates.</p>
          </div>
        </div>

        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close order form"
        >
          <X size={17} />
        </button>
      </div>

      <form className="create-order-form" onSubmit={handleSubmit}>
        <label className="form-field full-width">
          <span>Customer ID</span>
          <input
            name="customerId"
            value={form.customerId}
            onChange={updateField}
            placeholder="e.g. customer-001"
            maxLength={100}
            required
          />
        </label>

        <div className="coordinate-section">
          <h4>Pickup location</h4>
          <div className="coordinate-grid">
            <label className="form-field">
              <span>Latitude</span>
              <input
                name="pickupLatitude"
                type="number"
                min="-90"
                max="90"
                step="any"
                value={form.pickupLatitude}
                onChange={updateField}
                required
              />
            </label>

            <label className="form-field">
              <span>Longitude</span>
              <input
                name="pickupLongitude"
                type="number"
                min="-180"
                max="180"
                step="any"
                value={form.pickupLongitude}
                onChange={updateField}
                required
              />
            </label>
          </div>
        </div>

        <div className="coordinate-section">
          <h4>Delivery location</h4>
          <div className="coordinate-grid">
            <label className="form-field">
              <span>Latitude</span>
              <input
                name="deliveryLatitude"
                type="number"
                min="-90"
                max="90"
                step="any"
                value={form.deliveryLatitude}
                onChange={updateField}
                required
              />
            </label>

            <label className="form-field">
              <span>Longitude</span>
              <input
                name="deliveryLongitude"
                type="number"
                min="-180"
                max="180"
                step="any"
                value={form.deliveryLongitude}
                onChange={updateField}
                required
              />
            </label>
          </div>
        </div>

        <label className="form-field full-width">
          <span>Priority</span>
          <select name="priority" value={form.priority} onChange={updateField}>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </select>
        </label>

        {formError && (
          <p className="inline-error full-width" role="alert">
            {formError}
          </p>
        )}

        <div className="form-actions full-width">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={submitting}
          >
            {submitting ? "Creating order…" : "Create order"}
          </button>
        </div>
      </form>
    </section>
  );
}
