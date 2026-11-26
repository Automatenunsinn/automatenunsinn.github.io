import $ from 'jquery';
function addSortingFunctionality() {
    const $headers = $('th');
    $headers.click(function () {
        const columnIndex = $(this).index();
        const rows = $('#csv-table tbody tr').get();
        // Sort rows
        rows.sort((a, b) => {
            const aText = $(a).find('td').eq(columnIndex).text().toUpperCase();
            const bText = $(b).find('td').eq(columnIndex).text().toUpperCase();
            if (aText < bText)
                return -1;
            if (aText > bText)
                return 1;
            return 0;
        });
        // Append sorted rows to the table body
        $.each(rows, (_, row) => $('#csv-table tbody').append(row));
    });
}
addSortingFunctionality();
