const MAX_ORIGINAL_SIZE = 100 * 1024 * 1024; // 100 MB (We are attempting a lazy algo here so we can be generous with the size)
const MAX_WIDTH = 384; // printer image width

async function processImage(file) {
  if (!file || file.size === 0) {
    throw new Error("No image provided");
  }

  if (file.size > MAX_ORIGINAL_SIZE) {
    throw new Error("Image is too big. Try something under 100 MB plz.");
  }

  const bitmap = await createImageBitmap(file, { 
    resizeWidth: MAX_WIDTH, 
    resizeQuality: "pixelated" 
  });

  const blob = await bitmapToGrayJpeg(bitmap);
  bitmap.close();
  return blob;
}

async function bitmapToGrayJpeg(bitmap) {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");

  // White paper background for the printer transparency
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Let browser do grayscale with CSS
  ctx.filter = "grayscale(1)";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error("Failed to create JPEG")),
      "image/jpeg",
      0.7
    );
  });
}

const form = document.getElementById('submitForm');

form.addEventListener("submit", async e => {
  e.preventDefault();

  const submitButton = form.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = "Processing...";

  const formData = new FormData(form);
  const imageFile = formData.get("image");

  let processedBlob = null;

  try {
    if (imageFile && imageFile.size > 0) {
      processedBlob = await processImage(imageFile);

      // tiny safety belt
      if (processedBlob.size > 4 * 1024 * 1024) {
        throw new Error("Processed image is still too big. Try a smaller one.");
      }

      formData.set("image", processedBlob, "processed.jpg");
    }

    submitButton.textContent = "Sending...";

    const response = await fetch("/submit", {
      method: "POST",
      body: formData
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.errors?.join("\n") || result.error || "Something went wrong");
    }

    if (processedBlob) {
      const reader = new FileReader();
      reader.onload = () => {
        sessionStorage.setItem("processedImage", reader.result);
        const params = new URLSearchParams({
          id: result.id,
          name: formData.get('name'),
          message: formData.get('message')
        });
        window.location.href = `/thanks?${params.toString()}`;
      };
      reader.onerror = () => {
        const params = new URLSearchParams({
          id: result.id,
          name: formData.get('name'),
          message: formData.get('message')
        });
        window.location.href = `/thanks?${params.toString()}`;
      };
      reader.readAsDataURL(processedBlob);
    } else {
      const params = new URLSearchParams({
        id: result.id,
        name: formData.get('name'),
        message: formData.get('message')
      });
      window.location.href = `/thanks?${params.toString()}`;
    }
  } catch (err) {
    console.error("Submit error:", err);
    alert(err.message || "Failed to send");
    submitButton.textContent = originalText;
    submitButton.disabled = false;
  }
});