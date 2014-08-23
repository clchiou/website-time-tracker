#!/usr/bin/env python3

'''Tools for analyzing tracking data.'''

import argparse
import collections
import datetime
import os.path
import re
import sys


def read_data(args):
    '''Read input data.'''
    input_file = args.input
    if input_file is None:
        return read_data_(args, sys.stdin)
    else:
        with open(input_file, 'r') as input_file:
            return read_data_(args, input_file)


def read_data_(args, input_file):
    '''Implement read_data().'''
    data = []
    columns = parse_columns_string(args.input_columns)
    if not args.input_no_header:
        input_file.readline()  # Skip header
    for line in input_file:
        raw_row = line.split('\t')
        if len(raw_row) != len(columns):
            print('More than three columns:', line, end='', file=sys.stderr)
            continue
        try:
            start = parse_date(raw_row[columns['start']].strip())
            end = parse_date(raw_row[columns['end']].strip())
        except ValueError:
            print('Could not parse dates:', line, end='', file=sys.stderr)
            continue
        url = raw_row[columns['url']].strip()
        data.append({'url': url, 'start': start, 'end': end})
    return data


def write_data(args, data):
    '''Write output data.'''
    output_file = args.output
    if output_file is None:
        write_data_(args, data, sys.stdout)
    else:
        with open(output_file, 'w') as output_file:
            write_data_(args, data, output_file)


def write_data_(args, data, output_file):
    '''Implement write_data().'''
    columns = parse_columns_string(args.output_columns)
    if not args.output_no_header:
        print(args.output_columns.replace(',', '\t'), file=output_file)
    for row in data:
        row_list = [''] * len(columns)
        for name, value in row.items():
            row_list[columns[name]] = value
        print(*row_list, sep='\t', file=output_file)


def parse_columns_string(columns_string):
    '''Parse columns string.'''
    columns = {}
    for index, column in enumerate(columns_string.split(',')):
        columns[column] = index
    return columns


def parse_date(date_string):
    '''Parse date string.'''
    # We support two date formats:
    #   2001-01-01 00:00:00-07:00
    #   Mon Jan 01 2001 00:00:00 GMT-0700 (PDT)
    match = re.match(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d{2}):(\d{2})',
                     date_string)
    if match:
        try:
            return datetime.datetime.strptime(''.join(match.groups()),
                                              '%Y-%m-%d %H:%M:%S%z')
        except ValueError:
            pass
    # Try next format.
    match = re.match(
        r'\w{3} (\w{3}) (\d{2}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT(.\d{4})',
        date_string)
    if match:
        month = ('%02d' % (1 + [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Oct'
        ].index(match.group(1))))
        return datetime.datetime.strptime(
            '{2}-{month}-{1} {3}:{4}:{5} {6}'.format(
                *match.groups(), month=month),
            '%Y-%m-%d %H:%M:%S %z')
    # Could not parse date string.
    raise ValueError('Could not parse: ' + date_string)


def main_filter():
    '''main_filter().'''
    parser = argparse.ArgumentParser(description='Filter input data.')
    yield parser
    parser.add_argument('--output-no-header', action='store_true',
                        help='not output header')
    parser.add_argument(
        '--output-columns', default='url,start,end',
        help='comma-separated output columns')
    parser.add_argument('--output', help='output file (default to stdout)')
    parser.add_argument(
        '--after',
        help='show data more recent than this date (YYYYMMDD.[+-]HHMM)')
    parser.add_argument(
        '--before',
        help='show data more older than this date (YYYYMMDD.[+-]HHMM)')
    args = yield
    predicates = []
    if args.after is not None:
        after = datetime.datetime.strptime(args.after, '%Y%m%d.%z')
        predicates.append(lambda row: row['start'] >= after)
    if args.before is not None:
        before = datetime.datetime.strptime(args.before, '%Y%m%d.%z')
        predicates.append(lambda row: row['start'] <= before)
    data = read_data(args)
    if len(predicates) != 0:
        data = filter(lambda row: all(pred(row) for pred in predicates), data)
    write_data(args, data)
    return 0


def main_aggregate():
    '''main_aggregate().'''
    parser = argparse.ArgumentParser(description='Aggregate input data.')
    yield parser
    parser.add_argument('--output-no-header', action='store_true',
                        help='not output header')
    parser.add_argument(
        '--output-columns', default='site,time',
        help='comma-separated output columns')
    parser.add_argument('--output', help='output file (default to stdout)')
    parser.add_argument('--sort-by', default='site',
                        help='sort output by this column')
    parser.add_argument('--reverse', action='store_true',
                        help='reverse output order')
    args = yield
    data = read_data(args)
    aggregation = collections.defaultdict(lambda: 0)
    site_pattern = re.compile(r'https?://([^/]+)/')
    for row in data:
        match = site_pattern.match(row['url'])
        if not match:
            continue
        site = match.group(1)
        aggregation[site] += int((row['end'] - row['start']).total_seconds())
    aggregated_data = [{'site': site, 'time': time}
                       for site, time in aggregation.items()]
    aggregated_data.sort(key=lambda row: row[args.sort_by],
                         reverse=args.reverse)
    write_data(args, aggregated_data)
    return 0


def main(argv):
    '''main().'''
    main_funcs = {
        'filter': main_filter,
        'aggregate': main_aggregate,
    }
    main_func = main_funcs.get(os.path.basename(argv[0]))
    if main_func is None and len(argv) > 1:
        main_func = main_funcs.get(argv[1])
        argv = argv[1:]
    if main_func is None:
        parser = argparse.ArgumentParser(
            description='Tools for analyzing tracking data.')
        parser.add_argument('command', choices=sorted(main_funcs.keys()))
        parser.print_usage()
        return 1
    main_func = main_func()
    parser = next(main_func)
    parser.add_argument('--input-no-header', action='store_true',
                        help='input has no header')
    parser.add_argument(
        '--input-columns', default='url,start,end',
        help='comma-separated input columns')
    parser.add_argument('--input', help='input file (default to stdin)')
    next(main_func)
    args = parser.parse_args(argv[1:])
    try:
        main_func.send(args)
    except StopIteration as e:
        return e.value
    else:
        print('main() did not return.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
