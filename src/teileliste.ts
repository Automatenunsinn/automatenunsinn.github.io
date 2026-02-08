import { processCSV } from './utils/csvProcessor';
import * as $ from 'jquery';

async function fetchAndProcessCSV() {
    try {
        const response = await fetch('teile.tsv');
        if (!response.ok) {
            throw new Error(`Failed to fetch TSV: ${response.statusText}`);
        }
        const csvText = await response.text();
        const data = await processCSV(csvText);

        renderTable(data);
        addSortingFunctionality();
    } catch (error) {
        console.error('Error fetching or processing CSV:', error);
    }
}

function renderTable(data: any[]) {
    let tableContent = '<table id="csv-table" class="sortable"><thead><tr>';
    
    for (const key in data[0]) {
        tableContent += `<th>${key}</th>`;
    }
    
    tableContent += '</tr></thead><tbody>';

    data.forEach(row => {
        tableContent += '<tr>';
        for (const key in row) {
            tableContent += `<td>${row[key]}</td>`;
        }
        tableContent += '</tr>';
    });

    tableContent += '</tbody></table>';

    const tableContainer = <HTMLElement>document.getElementById('table-container');
    tableContainer.innerHTML = tableContent;
}

function addSortingFunctionality() {
    const $headers: JQuery<HTMLElement> = $('th');

    $headers.click(function (this: HTMLElement) {
        const columnIndex = $(this).index();
        const rows: HTMLElement[] = $('#csv-table tbody tr').get();

        // Sort rows
        rows.sort((a, b) => {
            const aText = $(a).find('td').eq(columnIndex).text().toUpperCase();
            const bText = $(b).find('td').eq(columnIndex).text().toUpperCase();

            if (aText < bText) return -1;
            if (aText > bText) return 1;
            return 0;
        });

        // Append sorted rows to the table body
        $.each(rows, (_, row: HTMLElement) => $('#csv-table tbody').append(row));
    });
}

fetchAndProcessCSV();