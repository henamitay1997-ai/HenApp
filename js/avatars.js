const AVATAR_MAX_BYTES = 120000;
const AVATAR_MAX_DIM = 400;

function getParentAvatar(data, parent) {
  return parent === 'a'
    ? (data.settings.parentAAvatar || '')
    : (data.settings.parentBAvatar || '');
}

function renderAvatar(name, url, options = {}) {
  const size = options.size || 56;
  const variant = options.variant || '';
  const className = options.className || 'avatar';
  const safeName = escapeHtml(name || '?');

  if (url) {
    return `<img src="${escapeHtml(url)}" alt="${safeName}" class="${className} avatar-img ${variant}" width="${size}" height="${size}" loading="lazy">`;
  }

  const initial = escapeHtml((name || '?').charAt(0));
  return `<div class="${className} avatar-fallback ${variant}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px" aria-hidden="true">${initial}</div>`;
}

function renderAvatarPicker(field, name, url, label, variant = '') {
  const safeUrl = url || '';
  return `
    <div class="avatar-picker" data-avatar-field="${field}">
      <label class="form-label">${label}</label>
      <div class="avatar-picker-row">
        <div data-avatar-preview="${field}">
          ${renderAvatar(name, safeUrl, { size: 72, variant })}
        </div>
        <div class="avatar-picker-actions">
          <label class="btn btn-outline btn-sm avatar-upload-btn">
            📷 בחר תמונה
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden data-avatar-input="${field}">
          </label>
          ${safeUrl ? `<button type="button" class="btn btn-outline btn-sm" data-avatar-remove="${field}">הסר תמונה</button>` : ''}
          <p class="form-hint">JPG, PNG או WebP · עד 5MB</p>
        </div>
      </div>
      <input type="hidden" name="${field}" value="${escapeHtml(safeUrl)}">
    </div>
  `;
}

function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('יש לבחור קובץ תמונה'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('התמונה גדולה מדי (מקסימום 5MB)'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, AVATAR_MAX_DIM / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > AVATAR_MAX_BYTES && quality > 0.4) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        if (dataUrl.length > AVATAR_MAX_BYTES) {
          reject(new Error('התמונה גדולה מדי גם אחרי דחיסה'));
          return;
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('לא ניתן לקרוא את התמונה'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
    reader.readAsDataURL(file);
  });
}

function getAvatarPreviewName(form, field) {
  if (field === 'parentAAvatar') {
    return form.querySelector('[name="parentAName"]')?.value || appData.settings.parentAName;
  }
  if (field === 'parentBAvatar') {
    return form.querySelector('[name="parentBName"]')?.value || appData.settings.parentBName;
  }
  if (field === 'avatarUrl') {
    return form.querySelector('[name="name"]')?.value || 'ילד/ה';
  }
  return '';
}

function getAvatarVariant(field) {
  if (field === 'parentAAvatar') return 'avatar-parent-a';
  if (field === 'parentBAvatar') return 'avatar-parent-b';
  return 'avatar-child';
}

function updateAvatarPreview(form, field, url) {
  const preview = form.querySelector(`[data-avatar-preview="${field}"]`);
  const hidden = form.querySelector(`[name="${field}"]`);
  if (hidden) hidden.value = url || '';
  if (preview) {
    preview.innerHTML = renderAvatar(
      getAvatarPreviewName(form, field),
      url,
      { size: 72, variant: getAvatarVariant(field) }
    );
  }
}

async function handleAvatarInputChange(input) {
  const field = input.dataset.avatarInput;
  const form = input.closest('form');
  if (!form || !field || !input.files?.[0]) return;

  try {
    showLoading(true);
    const dataUrl = await compressImageFile(input.files[0]);
    updateAvatarPreview(form, field, dataUrl);
    showToast('התמונה נטענה — לחצו שמור לשמירה', 'success');
  } catch (err) {
    showToast(err.message || 'שגיאה בטעינת התמונה');
  } finally {
    input.value = '';
    showLoading(false);
  }
}

function handleAvatarRemove(btn) {
  const field = btn.dataset.avatarRemove;
  const form = btn.closest('form');
  if (!form || !field) return;
  updateAvatarPreview(form, field, '');
  showToast('התמונה הוסרה — לחצו שמור לשמירה');
}

function initAvatarPickers(root = document) {
  root.querySelectorAll('[data-avatar-input]').forEach(input => {
    input.onchange = () => handleAvatarInputChange(input);
  });
  root.querySelectorAll('[data-avatar-remove]').forEach(btn => {
    btn.onclick = () => handleAvatarRemove(btn);
  });
}
