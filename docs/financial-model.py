"""逐月財務模型（36 個月）。參數見 docs/gtm-and-finance.md 第六節；執行：python3 docs/financial-model.py > docs/financial-model.csv
情境：改函式參數即可（price_l2、squad_size、guide_rate、cac_scale、b2b_mult、team_scale）。所有數字為提案值。"""
import csv, sys

def run(price_l2=1495, squad_size=5, guide_rate=15, cac_scale=1200, b2b_mult=1.0, team_scale=1.0):
    P = dict(price={'L0': 299, 'L1': 690, 'L2': price_l2, 'L3': price_l2}, ai=25, fee=0.03, line=5, bank=15,
             minutes={'L0': 0, 'L1': 4, 'L2': 14, 'L3': 20}, guide=guide_rate, patrol=5, sq=500, size=squad_size,
             churn={'L0': 0.12, 'L1': 0.10, 'L2': 0.08, 'L3': 0.08},
             team=[280000] * 3 + [420000] * 9 + [650000] * 12 + [900000] * 12,
             centers=[0] * 6 + [1] * 6 + [3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8] + [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 30])
    adds = []
    for m in range(36):
        if m == 0: adds.append({'L0': 15, 'L1': 15, 'L2': 15, 'L3': 15})
        elif m < 3: adds.append({'L0': 0, 'L1': 0, 'L2': 0, 'L3': 0})
        elif m < 12: adds.append({'L0': 40 + 10 * (m - 3), 'L1': 15 + 5 * (m - 3), 'L2': 20 + 4 * (m - 3), 'L3': 8 + 2 * (m - 3)})
        elif m < 24: adds.append({'L0': 150 + 15 * (m - 12), 'L1': 50 + 5 * (m - 12), 'L2': 50 + 5 * (m - 12), 'L3': 20 + 2 * (m - 12)})
        else: adds.append({'L0': 320 + 15 * (m - 24), 'L1': 100 + 6 * (m - 24), 'L2': 90 + 6 * (m - 24), 'L3': 35 + 2 * (m - 24)})
    act = {'L0': 0, 'L1': 0, 'L2': 0, 'L3': 0}; cum = 0; rows = []
    for m in range(36):
        for L in act: act[L] = act[L] * (1 - P['churn'][L]) + adds[m][L]
        rev = sum(act[L] * P['price'][L] for L in act) + P['centers'][m] * 60 * 250 * b2b_mult
        n = sum(act.values()); var = n * (P['ai'] + P['line'] + P['bank']) + rev * P['fee']
        human = sum(act[L] * P['minutes'][L] * 4.3 * (P['guide'] if L in ('L2', 'L3') else P['patrol']) for L in act)
        sf = (act['L2'] + act['L3']) / P['size'] * P['sq'] * 4.3
        gross = rev - var - human - sf; cac = sum(adds[m].values()) * (800 if m < 3 else cac_scale); team = P['team'][m] * team_scale
        op = gross - cac - team; cum += op
        rows.append(dict(month=m + 1, families=round(n), L0=round(act['L0']), L1=round(act['L1']), L2=round(act['L2']), L3=round(act['L3']),
                         centers=P['centers'][m], revenue=round(rev), var_cost=round(var), human_cost=round(human), squad_fixed=round(sf),
                         gross=round(gross), gross_margin=round(gross / rev * 100, 1) if rev else 0, cac=round(cac), team=round(team),
                         operating=round(op), cumulative=round(cum)))
    return rows

if __name__ == '__main__':
    rows = run()
    w = csv.DictWriter(sys.stdout, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
