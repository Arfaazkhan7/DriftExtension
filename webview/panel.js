(function () {
  // Acquire the VS Code API exactly once
  const vscode = acquireVsCodeApi();

  // State management
  let latestRunId = 0;
  let isAutoScanPaused = false;
  let currentGoal = '';
  let currentDescription = '';
  let currentRootPath = '';

  // DOM Elements - Toolbar
  const btnRescan = document.getElementById('btnRescan');
  const btnPauseToggle = document.getElementById('btnPauseToggle');
  const pauseToggleIcon = document.getElementById('pauseToggleIcon');
  const pauseToggleText = document.getElementById('pauseToggleText');
  const btnEditGoal = document.getElementById('btnEditGoal');
  const btnRefresh = document.getElementById('btnRefresh');

  // DOM Elements - Banners
  const analyzingBanner = document.getElementById('analyzingBanner');
  const analyzingText = document.getElementById('analyzingText');
  const pausedBanner = document.getElementById('pausedBanner');
  const errorBanner = document.getElementById('errorBanner');
  const errorText = document.getElementById('errorText');
  const btnDismissError = document.getElementById('btnDismissError');

  // DOM Elements - Project Overview
  const projectPathTitle = document.getElementById('projectPathTitle');
  const projectPath = document.getElementById('projectPath');
  const categoryBadge = document.getElementById('categoryBadge');
  const lastUpdated = document.getElementById('lastUpdated');
  const projectGoalText = document.getElementById('projectGoalText');
  const projectDescText = document.getElementById('projectDescText');
  const categoryChips = document.getElementById('categoryChips');
  const fileCountValue = document.getElementById('fileCountValue');
  const domainSummary = document.getElementById('domainSummary');

  // DOM Elements - Hero & Scores
  const statusBadge = document.getElementById('statusBadge');
  const scoreValue = document.getElementById('scoreValue');
  const driftScoreValue = document.getElementById('driftScoreValue');
  const alignmentProgress = document.getElementById('alignmentProgress');
  const confidenceValue = document.getElementById('confidenceValue');
  const readinessValue = document.getElementById('readinessValue');
  const coverageValue = document.getElementById('coverageValue');
  const completionValue = document.getElementById('completionValue');

  // DOM Elements - Breakdown
  const breakdownFeatureCov = document.getElementById('breakdownFeatureCov');
  const barFeatureCov = document.getElementById('barFeatureCov');
  const breakdownLexical = document.getElementById('breakdownLexical');
  const barLexical = document.getElementById('barLexical');
  const breakdownId = document.getElementById('breakdownId');
  const barId = document.getElementById('barId');
  const breakdownLib = document.getElementById('breakdownLib');
  const barLib = document.getElementById('barLib');
  const breakdownStruct = document.getElementById('breakdownStruct');
  const barStruct = document.getElementById('barStruct');
  const breakdownComp = document.getElementById('breakdownComp');
  const barComp = document.getElementById('barComp');

  // DOM Elements - Mentor & Features
  const mentorBrief = document.getElementById('mentorBrief');
  const projectSummary = document.getElementById('projectSummary');
  const dynamicFeatureList = document.getElementById('dynamicFeatureList');

  // DOM Elements - Diagnostics & Risk
  const diagnosticCount = document.getElementById('diagnosticCount');
  const diagnosticsList = document.getElementById('diagnosticsList');
  const riskBadge = document.getElementById('riskBadge');
  const riskText = document.getElementById('riskText');
  const riskFindingsList = document.getElementById('riskFindingsList');

  // DOM Elements - Error + Fix
  const errorIssue = document.getElementById('errorIssue');
  const errorLocationBox = document.getElementById('errorLocationBox');
  const errorBadCode = document.getElementById('errorBadCode');
  const errorFix = document.getElementById('errorFix');

  // DOM Elements - Architecture & Next Steps
  const whyDrift = document.getElementById('whyDrift');
  const primarySuggestion = document.getElementById('primarySuggestion');
  const suggestionList = document.getElementById('suggestionList');
  const architectureType = document.getElementById('architectureType');
  const architectureDetails = document.getElementById('architectureDetails');
  const uiBar = document.getElementById('uiBar');
  const backendBar = document.getElementById('backendBar');
  const logicBar = document.getElementById('logicBar');
  const uiValue = document.getElementById('uiValue');
  const backendValue = document.getElementById('backendValue');
  const logicValue = document.getElementById('logicValue');
  const readinessSummary = document.getElementById('readinessSummary');
  const readinessSignals = document.getElementById('readinessSignals');
  const strengthsList = document.getElementById('strengthsList');

  // DOM Elements - Matches & Reviews
  const topMatches = document.getElementById('topMatches');
  const missingTerms = document.getElementById('missingTerms');
  const fileReviews = document.getElementById('fileReviews');

  // DOM Elements - Trend Chart
  const trendLine = document.getElementById('trendLine');
  const trendArea = document.getElementById('trendArea');
  const trendDots = document.getElementById('trendDots');
  const trendHint = document.getElementById('trendHint');

  // DOM Elements - Goal Dialog Modal
  const goalModal = document.getElementById('goalModal');
  const goalForm = document.getElementById('goalForm');
  const inputGoal = document.getElementById('inputGoal');
  const inputDescription = document.getElementById('inputDescription');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCancelModal = document.getElementById('btnCancelModal');

  // Safe HTML Escaping
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- User Event Handlers ---

  if (btnRescan) {
    btnRescan.addEventListener('click', () => {
      vscode.postMessage({ type: 'rescanWorkspace' });
    });
  }

  if (btnPauseToggle) {
    btnPauseToggle.addEventListener('click', () => {
      if (isAutoScanPaused) {
        vscode.postMessage({ type: 'resumeAnalysis' });
      } else {
        vscode.postMessage({ type: 'pauseAnalysis' });
      }
    });
  }

  if (btnEditGoal) {
    btnEditGoal.addEventListener('click', () => {
      inputGoal.value = currentGoal || '';
      inputDescription.value = currentDescription || '';
      if (typeof goalModal.showModal === 'function') {
        goalModal.showModal();
      } else {
        vscode.postMessage({ type: 'action:editGoal' });
      }
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      vscode.postMessage({ type: 'refreshDashboard' });
    });
  }

  if (btnDismissError) {
    btnDismissError.addEventListener('click', () => {
      errorBanner.style.display = 'none';
    });
  }

  if (goalForm) {
    goalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const updatedGoal = inputGoal.value.trim();
      const updatedDesc = inputDescription.value.trim();
      if (!updatedGoal) {
        inputGoal.focus();
        return;
      }
      vscode.postMessage({
        type: 'updateGoal',
        goal: updatedGoal,
        description: updatedDesc,
      });
      goalModal.close();
    });
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      goalModal.close();
    });
  }

  if (btnCancelModal) {
    btnCancelModal.addEventListener('click', () => {
      goalModal.close();
    });
  }

  // Delegated file navigation click handler
  document.body.addEventListener('click', (e) => {
    const target = e.target.closest('.file-link');
    if (!target) return;

    const filePath = target.getAttribute('data-path');
    const lineStr = target.getAttribute('data-line');
    const colStr = target.getAttribute('data-col');

    if (!filePath) return;

    const line = lineStr ? parseInt(lineStr, 10) : undefined;
    const column = colStr ? parseInt(colStr, 10) : undefined;

    vscode.postMessage({
      type: 'openLocation',
      path: filePath,
      line: line && !isNaN(line) ? line : undefined,
      column: column && !isNaN(column) ? column : undefined,
    });
  });

  // --- Rendering Functions ---

  function setStatus(status, score) {
    statusBadge.textContent = status;
    const lower = String(status).toLowerCase().replace(/\s+/g, '-');
    statusBadge.className = `status status-${lower}`;

    const scorePct = Math.round((score || 0) * 100);
    const driftPct = Math.max(0, 100 - scorePct);

    scoreValue.textContent = `${scorePct}%`;
    driftScoreValue.textContent = `${driftPct}%`;
    alignmentProgress.style.width = `${scorePct}%`;
  }

  function setArea(area) {
    const ui = area?.UI || 0;
    const backend = area?.Backend || 0;
    const logic = area?.Logic || 0;

    uiBar.style.width = `${ui}%`;
    backendBar.style.width = `${backend}%`;
    logicBar.style.width = `${logic}%`;

    uiValue.textContent = `${ui}%`;
    backendValue.textContent = `${backend}%`;
    logicValue.textContent = `${logic}%`;
  }

  function setScoreBreakdown(breakdown, featureCoverage, completionScore) {
    const fCov = Math.round((featureCoverage || breakdown?.feature_coverage || 0) * 100);
    const lex = Math.round((breakdown?.goal_lexical_similarity || 0) * 100);
    const id = Math.round((breakdown?.identifier_alignment || 0) * 100);
    const lib = Math.round((breakdown?.library_import_alignment || 0) * 100);
    const struct = Math.round((breakdown?.structural_richness || 0) * 100);
    const comp = Math.round((completionScore || breakdown?.completion_score || 0) * 100);

    breakdownFeatureCov.textContent = `${fCov}%`;
    barFeatureCov.style.width = `${fCov}%`;

    breakdownLexical.textContent = `${lex}%`;
    barLexical.style.width = `${lex}%`;

    breakdownId.textContent = `${id}%`;
    barId.style.width = `${id}%`;

    breakdownLib.textContent = `${lib}%`;
    barLib.style.width = `${lib}%`;

    breakdownStruct.textContent = `${struct}%`;
    barStruct.style.width = `${struct}%`;

    breakdownComp.textContent = `${comp}%`;
    barComp.style.width = `${comp}%`;
  }

  function renderDynamicFeatures(features, legacyFeatureMap) {
    dynamicFeatureList.innerHTML = '';

    if (features && features.length > 0) {
      features.forEach(feat => {
        const card = document.createElement('div');
        card.className = 'feature-card';

        const statusClass = feat.status === 'implemented' ? 'status-aligned'
          : feat.status === 'partial' ? 'status-drifting'
          : feat.status === 'missing' ? 'status-danger' : 'status-neutral';

        const statusLabel = feat.status === 'implemented' ? 'Implemented'
          : feat.status === 'partial' ? 'Partially Implemented'
          : feat.status === 'missing' ? 'Missing' : 'Unverified';

        // Check for empty stubs warning
        const isStub = feat.status === 'partial' && (
          (feat.missing_details && feat.missing_details.toLowerCase().includes('stub')) ||
          (feat.evidence && feat.evidence.some(e => e.toLowerCase().includes('empty stub')))
        );

        let filesHtml = '';
        if (feat.files && feat.files.length > 0) {
          filesHtml = `
            <div class="feature-evidence-box">
              <span class="evidence-label">Supporting Source Files:</span>
              <div class="file-tags-list">
                ${feat.files.map((f, i) => {
                  const line = feat.lines && feat.lines[i] ? feat.lines[i] : (feat.lines?.[0] || '');
                  return `<button class="file-link" data-path="${escapeHtml(f)}" data-line="${line || ''}">📄 ${escapeHtml(f)}${line ? `:${line}` : ''}</button>`;
                }).join('')}
              </div>
            </div>
          `;
        }

        let evidenceHtml = '';
        if (feat.evidence && feat.evidence.length > 0) {
          evidenceHtml = `
            <div class="feature-evidence-box">
              <span class="evidence-label">Implementation Evidence:</span>
              <ul class="list compact" style="margin: 0; padding-left: 14px;">
                ${feat.evidence.map(e => `<li>${escapeHtml(e)}</li>`).join('')}
              </ul>
            </div>
          `;
        }

        card.innerHTML = `
          <div class="feature-card-header">
            <div>
              <h4 class="feature-title">${escapeHtml(feat.name)}</h4>
              <p class="feature-desc">${escapeHtml(feat.description || '')}</p>
            </div>
            <span class="status ${statusClass}">${statusLabel}</span>
          </div>
          ${isStub ? '<div class="stub-warning-box"><span>⚠️ Empty stubs detected: Function contains placeholder body without substantive logic.</span></div>' : ''}
          ${evidenceHtml}
          ${filesHtml}
          ${feat.missing_details ? `<div class="next-action-note"><strong>Gap:</strong> ${escapeHtml(feat.missing_details)}</div>` : ''}
          ${feat.next_action ? `<div class="next-action-note"><strong>Next Step:</strong> ${escapeHtml(feat.next_action)}</div>` : ''}
        `;

        dynamicFeatureList.appendChild(card);
      });
      return;
    }

    // Fallback to legacy feature_map
    if (legacyFeatureMap && legacyFeatureMap.length > 0) {
      legacyFeatureMap.forEach(item => {
        const card = document.createElement('div');
        card.className = 'feature-card';
        card.innerHTML = `
          <div class="feature-card-header">
            <h4 class="feature-title">${escapeHtml(item.feature)}</h4>
            <span class="status status-${String(item.status).toLowerCase()}">${escapeHtml(item.status)}</span>
          </div>
          <p class="feature-desc">${escapeHtml((item.evidence || []).join(', '))}</p>
        `;
        dynamicFeatureList.appendChild(card);
      });
      return;
    }

    dynamicFeatureList.innerHTML = '<p class="muted">No requirements derived from the current goal.</p>';
  }

  function renderDiagnostics(diagnostics) {
    diagnosticsList.innerHTML = '';
    const count = diagnostics ? diagnostics.length : 0;
    diagnosticCount.textContent = `${count} ${count === 1 ? 'issue' : 'issues'}`;

    if (!diagnostics || diagnostics.length === 0) {
      diagnosticsList.innerHTML = '<p class="muted" style="padding: 10px 0;">No syntax or structural diagnostics detected. All analyzed files parsed cleanly.</p>';
      return;
    }

    diagnostics.forEach(diag => {
      const item = document.createElement('div');
      item.className = 'diagnostic-item';

      const sevClass = diag.severity === 'error' ? 'badge-danger' : 'badge-warning';

      item.innerHTML = `
        <div class="diagnostic-header">
          <button class="file-link" data-path="${escapeHtml(diag.file)}" data-line="${diag.line}" data-col="${diag.column}">
            📍 ${escapeHtml(diag.file)}:${diag.line}:${diag.column}
          </button>
          <span class="badge ${sevClass}">${escapeHtml(diag.severity.toUpperCase())}</span>
        </div>
        <div style="font-weight: 500; font-size: 12px;">${escapeHtml(diag.message)}</div>
        ${diag.snippet ? `<pre class="code-block">${escapeHtml(diag.snippet)}</pre>` : ''}
        ${diag.suggested_fix ? `<div class="next-action-note"><strong>Suggested Fix:</strong> ${escapeHtml(diag.suggested_fix)}</div>` : ''}
      `;
      diagnosticsList.appendChild(item);
    });
  }

  function renderRiskFindings(findings, level, riskSummary) {
    riskText.textContent = riskSummary || 'No risk signals detected.';
    riskBadge.textContent = level || 'Low';
    riskBadge.className = `risk risk-${String(level || 'low').toLowerCase()}`;

    riskFindingsList.innerHTML = '';
    if (!findings || findings.length === 0) {
      return;
    }

    findings.forEach(finding => {
      const item = document.createElement('div');
      item.className = 'risk-item';

      const sevClass = finding.severity === 'high' ? 'badge-danger' : finding.severity === 'medium' ? 'badge-warning' : 'badge-success';

      item.innerHTML = `
        <div class="risk-item-header">
          <strong>${escapeHtml(finding.category)}</strong>
          <span class="badge ${sevClass}">${escapeHtml(finding.severity.toUpperCase())}</span>
        </div>
        <p class="body-copy text-small" style="margin: 4px 0;">${escapeHtml(finding.explanation)}</p>
        ${finding.suggested_correction ? `<div class="next-action-note"><strong>Mitigation:</strong> ${escapeHtml(finding.suggested_correction)}</div>` : ''}
      `;
      riskFindingsList.appendChild(item);
    });
  }

  function renderInteractiveList(element, items, formatter) {
    element.innerHTML = '';
    if (!items || !items.length) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'No data available.';
      element.appendChild(li);
      return;
    }

    items.forEach(item => {
      const li = document.createElement('li');
      const rendered = formatter(item);
      if (typeof rendered === 'string') {
        li.innerHTML = rendered;
      } else {
        li.appendChild(rendered);
      }
      element.appendChild(li);
    });
  }

  function drawTrend(points) {
    if (!points || !points.length) {
      trendLine.setAttribute('d', '');
      trendArea.setAttribute('d', '');
      trendDots.innerHTML = '';
      return;
    }

    const width = 600;
    const height = 220;
    const padding = 24;
    const stepX = points.length === 1 ? 0 : (width - padding * 2) / (points.length - 1);

    const coordinates = points.map((value, index) => {
      const x = padding + index * stepX;
      const y = height - padding - (Math.max(0, Math.min(1, value)) * (height - padding * 2));
      return [x, y];
    });

    let line = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point[0]} ${point[1]}`).join(' ');
    if (coordinates.length === 1) {
      const [x, y] = coordinates[0];
      line = `M ${x - 0.1} ${y} L ${x + 0.1} ${y}`;
    }
    const area = `${line} L ${coordinates[coordinates.length - 1][0]} ${height - padding} L ${coordinates[0][0]} ${height - padding} Z`;
    trendLine.setAttribute('d', line);
    trendArea.setAttribute('d', area);
    trendDots.innerHTML = coordinates
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" class="trend-dot"></circle>`)
      .join('');
    trendHint.textContent = points.length === 1
      ? 'Run analysis again after saving files to grow the trend trajectory.'
      : `Trajectory history: ${points.length} scan points`;
  }

  // --- Message Listener from Extension Host ---

  window.addEventListener('message', (event) => {
    try {
      const message = event.data;
      if (!message || typeof message !== 'object') return;

      switch (message.type) {
        case 'analysisStarted':
          analyzingBanner.style.display = 'flex';
          analyzingText.textContent = message.reason || 'Analyzing workspace files...';
          errorBanner.style.display = 'none';
          break;

        case 'analysisProgress':
          analyzingBanner.style.display = 'flex';
          analyzingText.textContent = message.message || 'Analyzing...';
          break;

        case 'analysisPaused':
          isAutoScanPaused = true;
          pauseToggleIcon.textContent = '▶';
          pauseToggleText.textContent = 'Auto-Scan: Paused';
          pausedBanner.style.display = 'flex';
          break;

        case 'analysisResumed':
          isAutoScanPaused = false;
          pauseToggleIcon.textContent = '⏸';
          pauseToggleText.textContent = 'Auto-Scan: Active';
          pausedBanner.style.display = 'none';
          break;

        case 'analysisFailed':
          analyzingBanner.style.display = 'none';
          errorBanner.style.display = 'flex';
          errorText.textContent = message.error || 'Analysis encountered an error.';
          break;

        case 'goalUpdated':
          currentGoal = message.goal;
          currentDescription = message.description;
          projectGoalText.textContent = message.goal;
          projectDescText.textContent = message.description || 'No architecture details specified.';
          break;

        case 'diagnosticsUpdated':
          renderDiagnostics(message.diagnostics);
          break;

        case 'analysisCompleted':
        case 'analysis:update': {
          analyzingBanner.style.display = 'none';
          errorBanner.style.display = 'none';

          if (message.runId && message.runId < latestRunId) {
            return; // Reject stale run
          }
          if (message.runId) {
            latestRunId = message.runId;
          }

          const payload = message.payload;
          const result = payload?.result;
          if (!result) return;

          // Cache current project metadata
          currentRootPath = payload.rootPath || '';
          currentGoal = payload.goal || '';
          currentDescription = payload.description || '';

          // Overview Header
          const rootBaseName = currentRootPath ? currentRootPath.split(/[\\/]/).filter(Boolean).pop() : 'Active Workspace';
          projectPathTitle.textContent = rootBaseName;
          projectPath.textContent = currentRootPath || 'No workspace root';
          projectGoalText.textContent = currentGoal || 'No goal stated.';
          projectDescText.textContent = currentDescription || 'No architecture details specified.';

          // Category Badges & Chips
          const categories = result.project_categories || (result.dominant_category ? [result.dominant_category] : ['Generic Application']);
          categoryBadge.textContent = `Category: ${result.dominant_category || categories[0] || 'Generic'}`;
          categoryChips.innerHTML = categories.map(c => `<span class="chip">${escapeHtml(c)}</span>`).join('');
          lastUpdated.textContent = `Last scanned: ${new Date().toLocaleTimeString()}`;

          // File count & domain summary
          fileCountValue.textContent = String(result.file_count || 0);
          domainSummary.textContent = `${categories.join(' • ')} (${result.file_count || 0} eligible files evaluated)`;

          // Hero Scores
          setStatus(result.status, result.score);
          confidenceValue.textContent = `${Math.round((result.confidence || 0) * 100)}%`;
          readinessValue.textContent = result.readiness?.level || 'Low';
          coverageValue.textContent = `${Math.round((result.coverage_score || 0) * 100)}%`;
          completionValue.textContent = `${Math.round((result.completion_score || 0) * 100)}%`;

          // Score Breakdown
          setScoreBreakdown(result.score_breakdown, result.coverage_score, result.completion_score);

          // Mentor Brief & Project Summary
          mentorBrief.textContent = result.mentor_brief || result.reason;
          projectSummary.textContent = result.project_summary || '';

          // Dynamic Requirements
          renderDynamicFeatures(result.features, result.feature_map);

          // Diagnostics & Risk
          renderDiagnostics(result.diagnostics);
          renderRiskFindings(result.risk_findings, result.risk_level, result.risk);

          // Error + Fix
          errorIssue.textContent = result.error_fix?.issue || 'No critical issue detected.';
          if (result.error_fix?.file) {
            const locLine = result.error_fix.line || '1';
            errorLocationBox.innerHTML = `<button class="file-link" data-path="${escapeHtml(result.error_fix.file)}" data-line="${locLine}">📍 ${escapeHtml(result.error_fix.file)}:${locLine}</button>`;
          } else {
            errorLocationBox.textContent = 'No exact error location found.';
          }
          errorBadCode.textContent = result.error_fix?.bad_code || 'No problem code found.';
          errorFix.textContent = result.error_fix?.fixed_code || result.error_fix?.fix || 'No fix available.';

          // Why & Next Steps
          whyDrift.textContent = result.why || result.reason;
          primarySuggestion.textContent = result.suggestion || 'No suggestion yet.';
          suggestionList.innerHTML = '';
          (result.suggestions || []).forEach(s => {
            const li = document.createElement('li');
            li.textContent = s;
            suggestionList.appendChild(li);
          });

          // Area & Architecture
          setArea(result.area);
          architectureType.textContent = result.architecture?.type || 'Architecture summary unavailable.';
          architectureDetails.innerHTML = `
            <li>Dominant Area: <strong>${escapeHtml(result.architecture?.dominant_area || 'Unknown')}</strong></li>
            <li>Languages: ${escapeHtml((result.architecture?.languages || []).join(', ') || 'Unknown')}</li>
            <li>Primary Files: ${escapeHtml((result.architecture?.primary_files || []).join(', ') || 'Unknown')}</li>
          `;

          // Readiness Signals & Strengths
          readinessSummary.textContent = result.readiness?.summary || 'No readiness data yet.';
          readinessSignals.innerHTML = '';
          (result.readiness?.signals || []).forEach(sig => {
            const li = document.createElement('li');
            li.textContent = sig;
            readinessSignals.appendChild(li);
          });

          strengthsList.innerHTML = '';
          (result.strengths || []).forEach(str => {
            const li = document.createElement('li');
            li.textContent = str;
            strengthsList.appendChild(li);
          });

          // Interactive Top Matches
          renderInteractiveList(topMatches, result.top_matches, item => {
            return `
              <button class="file-link" data-path="${escapeHtml(item.path)}">📄 ${escapeHtml(item.path)}</button>
              <strong style="color: var(--color-green); font-size: 11px;">${Math.round(item.score * 100)}%</strong>
            `;
          });

          // Missing Terms Chips
          missingTerms.innerHTML = '';
          if (!result.missing_terms || !result.missing_terms.length) {
            missingTerms.innerHTML = '<li class="muted">All identified goal concepts appear in source code.</li>';
          } else {
            result.missing_terms.forEach(term => {
              const li = document.createElement('li');
              li.className = 'chip';
              li.textContent = term;
              missingTerms.appendChild(li);
            });
          }

          // Interactive File Reviews
          renderInteractiveList(fileReviews, result.file_reviews, rev => {
            const badgeClass = rev.alignment === 'High' ? 'badge-success' : rev.alignment === 'Medium' ? 'badge-warning' : 'badge-danger';
            return `
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <button class="file-link" data-path="${escapeHtml(rev.path)}">📄 ${escapeHtml(rev.path)}</button>
                <span class="body-copy text-small muted">${escapeHtml(rev.summary)}</span>
              </div>
              <span class="badge ${badgeClass}">${escapeHtml(rev.alignment)}</span>
            `;
          });

          // Trend Chart
          drawTrend(result.graph || []);
          break;
        }

        case 'analysis:status':
          if (message.payload?.status === 'analyzing') {
            analyzingBanner.style.display = 'flex';
            analyzingText.textContent = message.payload.message || 'Analyzing...';
          } else if (message.payload?.status === 'error') {
            analyzingBanner.style.display = 'none';
            errorBanner.style.display = 'flex';
            errorText.textContent = message.payload.message || 'Analysis error.';
          }
          break;
      }
    } catch (err) {
      console.error('[DriftAI panel error]', err);
    }
  });

  // Signal ready to extension host
  vscode.postMessage({ type: 'ready' });
})();
