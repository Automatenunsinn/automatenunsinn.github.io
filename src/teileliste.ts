import * as $ from 'jquery';

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

addSortingFunctionality();
