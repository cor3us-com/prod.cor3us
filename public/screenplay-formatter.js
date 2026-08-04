// Screenplay Formatter for EK1 (Standard Screenplay) and EK2 (Shooting Script Table)


export function parseFountainToElements(fountainText) {
  const lines = fountainText.replace(/\r\n/g, '\n').split('\n');
  const elements = [];
  let currentScene = null;
  let inProductionBlock = false;
  let prodBlockText = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('/* @production')) {
      inProductionBlock = true;
      prodBlockText = '';
      continue;
    }
    if (inProductionBlock) {
      if (trimmed.includes('*/')) {
        inProductionBlock = false;
        if (currentScene) {
          try {
            currentScene.production = JSON.parse(prodBlockText);
          } catch (e) {}
        }
      } else {
        prodBlockText += rawLine + '\n';
      }
      continue;
    }

    if (!trimmed) continue;

    // Scene Heading
    const isHeading = /^(?:\.?)(?:INT(?:\/EXT)?|EXT(?:\/INT)?|I\/E|İÇ(?:\/DIŞ)?|DIŞ(?:\/İÇ)?)\.?\s+/iu.test(trimmed);
    if (isHeading) {
      const idMatch = /#(SC-\d{3,})#\s*$/iu.exec(trimmed);
      const sceneId = idMatch ? idMatch[1].toUpperCase() : `SC-${String(elements.filter(e => e.type === 'scene').length + 1).padStart(3, '0')}`;
      const title = trimmed.replace(/#SC-\d{3,}#\s*$/iu, '').trim();

      currentScene = {
        type: 'scene',
        sceneId,
        title,
        production: null,
        blocks: []
      };
      elements.push(currentScene);
      continue;
    }

    if (!currentScene) {
      currentScene = {
        type: 'scene',
        sceneId: 'SC-000',
        title: 'ÖNSÖZ',
        production: null,
        blocks: []
      };
      elements.push(currentScene);
    }

    // Character line (ALL CAPS, short line, not ending with punctuation)
    const isCharacter = /^[A-ZÇĞİÖŞÜ0-9\s\.\-']{2,30}$/.test(trimmed) && !trimmed.endsWith('.') && !trimmed.endsWith(':');
    if (isCharacter && i + 1 < lines.length && lines[i + 1].trim()) {
      let charName = trimmed;
      let parenthetical = null;
      let dialogue = [];

      let j = i + 1;
      if (j < lines.length && lines[j].trim().startsWith('(')) {
        parenthetical = lines[j].trim();
        j++;
      }

      while (j < lines.length && lines[j].trim() && !lines[j].trim().startsWith('/*')) {
        const lineVal = lines[j].trim();
        if (/^[A-ZÇĞİÖŞÜ0-9\s\.\-']{2,30}$/.test(lineVal) && !lineVal.endsWith('.')) break;
        dialogue.push(lineVal);
        j++;
      }

      if (dialogue.length > 0) {
        currentScene.blocks.push({
          type: 'dialogue_block',
          character: charName,
          parenthetical,
          dialogue: dialogue.join(' ')
        });
        i = j - 1;
        continue;
      }
    }

    // Action line
    currentScene.blocks.push({
      type: 'action',
      text: rawLine
    });
  }

  return elements;
}

// Render EK1 Standard Format (Google Doc Document View)
export function renderEK1Html(elements) {
  let html = '';
  let sceneNum = 1;

  for (const scene of elements) {
    html += `
      <div class="ek1-scene" id="scene-${scene.sceneId}" data-scene-id="${scene.sceneId}">
        <div class="ek1-heading">${sceneNum}. ${scene.title} <span class="badge badge-primary" style="font-size: 0.75rem; margin-left: 0.5rem;">${scene.sceneId}</span></div>
    `;

    if (scene.production && scene.production.camera_sound_notes) {
      html += `<div class="ek1-prod-note">⚠️ ${scene.production.camera_sound_notes}</div>`;
    }

    for (const block of scene.blocks) {
      if (block.type === 'action') {
        html += `<div class="ek1-action">${block.text}</div>`;
      } else if (block.type === 'dialogue_block') {
        html += `
          <div class="ek1-dialogue-wrapper">
            <div class="ek1-character">${block.character}</div>
            ${block.parenthetical ? `<div class="ek1-parenthetical">${block.parenthetical}</div>` : ''}
            <div class="ek1-dialogue">${block.dialogue}</div>
          </div>
        `;
      }
    }

    html += `</div>`;
    sceneNum++;
  }

  return html;
}

// Render EK2 Shooting Script Table Format (Ornekler.pdf EK2 Table View)
export function renderEK2Html(elements) {
  let html = `
    <table class="ek2-table">
      <thead>
        <tr>
          <th>SAHNE / Plan No</th>
          <th>ÇEKİM ÖLÇEĞİ</th>
          <th>İÇERİK / OYUN / DİYALOG</th>
          <th>DEKOR / KOSTÜM / AKSESUAR</th>
          <th>SES / MÜZİK / EFEKT</th>
          <th>KAMERA HAREKETİ</th>
          <th>TAHMİNİ SÜRE</th>
        </tr>
      </thead>
      <tbody>
  `;

  let sceneCount = 1;
  for (const scene of elements) {
    const prod = scene.production || {};
    const castList = (prod.cast || []).map(c => typeof c === 'string' ? c : c.name).join(', ');
    const propsList = (prod.props || []).join(', ');
    const wardrobeStr = prod.wardrobe_makeup || '-';

    let shotIndex = 1;
    for (const block of scene.blocks) {
      if (block.type === 'action' || block.type === 'dialogue_block') {
        const shotNo = `${sceneCount}/${shotIndex}`;
        const shotScale = shotIndex === 1 ? '1.ORTA' : (shotIndex % 2 === 0 ? 'YAKIN' : 'GENEL');
        
        let contentHtml = '';
        if (block.type === 'action') {
          contentHtml = block.text;
        } else {
          contentHtml = `
            <div style="text-align: center; font-weight: bold; font-family: 'Courier Prime', monospace;">${block.character}</div>
            ${block.parenthetical ? `<div style="text-align: center; font-style: italic; font-size: 0.85em;">${block.parenthetical}</div>` : ''}
            <div style="text-align: center;">${block.dialogue}</div>
          `;
        }

        html += `
          <tr>
            <td style="font-weight: bold; text-align: center;">${scene.sceneId}<br><span style="font-size:0.8em; color:#666;">Plan ${shotNo}</span></td>
            <td style="text-align: center; font-weight: 600;">${shotScale}</td>
            <td>${contentHtml}</td>
            <td><strong>Decor/Kostüm:</strong> ${wardrobeStr}<br><strong>Props:</strong> ${propsList || '-'}</td>
            <td>${prod.camera_sound_notes ? 'Prod Notu: ' + prod.camera_sound_notes : 'Ortam Sesi / Diyalog'}</td>
            <td style="text-align: center;">${shotIndex === 1 ? 'Sabit' : 'Sağa Kaydırma'}</td>
            <td style="text-align: center; font-weight: 600;">${Math.round((prod.estimated_shoot_time_min || 2) * 30 / scene.blocks.length)} sn</td>
          </tr>
        `;
        shotIndex++;
      }
    }
    sceneCount++;
  }

  html += `
      </tbody>
    </table>
  `;

  return html;
}
