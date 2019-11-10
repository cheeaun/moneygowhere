import { h, render, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import PieChart from 'react-minimal-pie-chart';

import creditCardImg from './creditcard.svg';

import data from '../data.json';
// Parcel imports JSON file as JS data, instead of an external static file https://github.com/parcel-bundler/parcel/issues/501
// TODO: fetch() the data file or API instead

const TRANSACTIONS = [];
data.accounts.forEach(account => {
  const tx = account.transactions.map(transaction => ({
    ...transaction,
    _account_id: account.id,
  }));
  TRANSACTIONS.push(...tx);
});

data.cards.forEach(card => {
  const tx = card.transactions.map(transaction => ({
    ...transaction,
    _card_id: card.id,
  }));
  TRANSACTIONS.push(...tx);
});

const cashflowByMonth = {};
let maxAmount = 0;
TRANSACTIONS.forEach(transaction => {
  const [_, month] = transaction.date.match(/-(\d+)-/) || [,];
  if (month) {
    if (!cashflowByMonth[month]) cashflowByMonth[month] = { in: 0, out: 0 };
    const { amount } = transaction;
    if (amount >= 0) { // IN
      cashflowByMonth[month].in += amount;
    } else { // OUT
      cashflowByMonth[month].out += amount;
    }
    if (Math.abs(amount) > maxAmount) maxAmount = Math.abs(amount);
  }
});

// 7 colors, have to add more if there are more categories...
// Stolen from https://projects.susielu.com/viz-palette
const COLORS = ["#ffd700", "#ffb14e", "#fa8775", "#ea5f94", "#cd34b5", "#9d02d7", "#0000ff"];

// Mock list of months
// Using '0X' format for easy ref
const MONTHS = ['03', '04', '05', '06'];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatMoney = (amount) => { // cents
  return (amount/100).toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
};

const fakeCardNumber = (cardID) => {
  // Fake one here, simulating last 4 digits of a card
  // Not sure if this is useful, but at least good for extra metadata and debugging
  return cardID.match(/\d/g).join('').slice(0, 4);
};

const App = () => {
  const [cardID, setCardID] = useState('');
  const [category, setCategory] = useState(null);
  const [month, setMonth] = useState('06'); // defaults to June

  const monthSelectorRef = useRef(null);
  useEffect(() => {
    // Using hashchange instead of a routing library
    const hashchange = () => {
      const [_, month] = location.hash.match(/month-(\d+)/) || [,];
      if (month) {
        setMonth(month);
        monthSelectorRef.current.scrollLeft = document.getElementById(`month-${month}`).offsetLeft - window.innerWidth/6;
      } else {
        location.hash = 'month-06';
      }
    };
    window.onhashchange = hashchange;
    hashchange();
  }, []);

  const transactionsPerMonth = TRANSACTIONS
  .filter(t => t.date.includes(`-${month}-`)) // Scary assumption here but oh well
  .sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });
  const transformedTransactions = transactionsPerMonth
    .filter(t => cardID ? t._card_id === cardID : true)
    .filter(t => category ? t.category === category : true);

  const pieData = [];
  const pieDataHash = {};
  const categories = [];
  transactionsPerMonth.forEach(tx => {
    const { category } = tx;
    if (category) {
      if (!pieDataHash[category]) pieDataHash[category] = 0;
      pieDataHash[category] += Math.abs(tx.amount);
    }
  });
  Object.entries(pieDataHash).forEach(([cat, amount], i) => {
    categories.push(cat);
    pieData.push({
      title: cat,
      value: amount,
      color: COLORS[i],
    });
  });

  let prevDateStamp = null;

  return (
    <>
      <ul id="month-selector" ref={monthSelectorRef}>
        {Object.entries(cashflowByMonth).map(([month, flow]) => {
          return (
            <li>
              <a id={`month-${month}`} href={`#month-${month}`}>
                <b class="block">
                  {MONTH_NAMES[Number(month)-1]} 2019
                </b>
                <span class="bar-container block">
                  <span class="bar in" style={{ borderBottomWidth: flow.in/maxAmount*100 }} />
                  <span class="bar out" style={{ borderBottomWidth: Math.abs(flow.out)/maxAmount*100 }} />
                </span>
                <span class="block amount in">$ {formatMoney(flow.in)}</span>
                <span class="block amount out negative">$ {formatMoney(flow.out)}</span>
              </a>
            </li>
          );
        })}
        <li>
          <a id="month-06" href="#month-06">
            <b class="block">
              Jun 2019
            </b>
            <span class="bar-container">
              <span class="bar in" />
              <span class="bar out" />
            </span>
            <span class="block amount in">$ 0</span>
            <span class="block amount out negative">$ 0</span>
          </a>
        </li>
      </ul>
      <div class="container">
        <h2>{MONTH_NAMES[Number(month)-1]} 2019</h2>
        {!!pieData.length && (
          <div id="pie">
            <PieChart
              data={pieData}
              animate
              radius={25}
              label={l => l.data[l.dataIndex].title}
              labelPosition={112}
              labelStyle={{
                fontSize: '4px',
              }}
              onClick={(e, propsData, index) => {
                const { title } = propsData[index];
                setCategory(title);
              }}
            />
          </div>
        )}
        <div id="transactions-header">
          <h3>Transactions</h3>
          {(
            <div class="selectors">
              <span id="category-selector">
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  <option selected>All categories</option>
                  {categories.map(c => (
                    <option value={c}>{c}</option>
                  ))}
                </select>
              </span>
              <span id="card-selector">
                <label>
                  <img height="13" src={creditCardImg} alt="" />
                  <select value={cardID} onChange={e => setCardID(e.target.value)}>
                    <option selected>All cards</option>
                    {data.cards.map(c => (
                      <option value={c.id}>
                        {c.name}{'—'}
                        {fakeCardNumber(c.id)}
                      </option>
                    ))}
                  </select>
                </label>
              </span>
              {!!(category || cardID) && (
                <button type="button" onClick={() => {
                  setCardID('');
                  setCategory(null);
                }}>
                  <b>Show all</b>
                </button>
              )}
            </div>
          )}
        </div>
        <table id="transactions">
          <tbody>
            {transformedTransactions.length ? (
              transformedTransactions.map(t => {
                const date = new Date(t.date);
                const showDateStamp = t.date !== prevDateStamp;
                prevDateStamp = t.date;
                return (
                  <tr class={/(0|6)/.test(date.getDay()) ? 'weekend' : ''}>
                    <td class="timestamp">
                      {showDateStamp && (
                        <>
                          <span class="day">{DAY_NAMES[date.getDay()]}</span>
                          {' '}<br />
                          {date.getDate()} {MONTH_NAMES[date.getMonth()]}
                        </>
                      )}
                    </td>
                    <td class="description">
                      {t.description}<br />
                      {!!t.category && (
                        <span class="category">
                          <span class="cat-circle" style={{ backgroundColor: pieData.find((d => d.title === t.category)).color }}></span>
                          {' '}
                          {t.category}
                        </span>
                      )}
                      {!!t._account_id && (
                        <span class="account">
                          {data.accounts.find((acc) => acc.id === t._account_id).name}
                        </span>
                      )}
                    </td>
                    <td class="money">
                      <span class={`amount ${t.amount < 0 ? 'negative' : ''}`}>
                        {formatMoney(t.amount)}
                      </span> <span class="currency">SGD</span>
                      <br />
                      {!!t._card_id && (
                        <span class="card inline-block">
                          <img height="13" src={creditCardImg} />{' '}
                          {fakeCardNumber(t._card_id)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <div class="container">Either no transactions available yet or none matching the active filters.</div>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};
render(<App />, document.getElementById('app'));