export function formatNumber(number: any) {
    if (isNaN(number / 1.0)) {
        return number
    }
    var n = number
    var s = ''
    if (number > 1000000000) {
        n = number / 1000000000.0
        s = 'B'
    } else if (number > 1000000) {
        n = number / 1000000.0
        s = 'M'
    }

    // format n to 2 decimal places
    n = Math.round(n * 100) / 100

    return new Intl.NumberFormat('en').format(n) + s
}
