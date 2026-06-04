import { processCSVSync } from './csvProcessor';

function escapeHtml(value: string): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Renders the parts list as a static HTML table string. This is the single
 * source of truth for the table markup and is used at build time (so the table
 * is part of teileliste.html and indexable by search engines) — at runtime only
 * the sorting behaviour is attached to the already-rendered table.
 */
export function renderTeileTable(tsv: string): string {
    const data = processCSVSync(tsv);

    let html = '<div class="table-responsive"><table id="csv-table" class="table table-striped table-hover align-middle"><thead><tr>';

    for (const key in data[0]) {
        html += `<th scope="col">${escapeHtml(key)}</th>`;
    }

    html += '</tr></thead><tbody>';

    data.forEach(row => {
        html += '<tr>';
        for (const key in row) {
            html += `<td>${escapeHtml(row[key])}</td>`;
        }
        html += '</tr>';
    });

    html += '</tbody></table></div>';

    return html;
}
