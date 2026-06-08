#include <iostream>
#include <iomanip>
#include <string>
using namespace std;

int main() {
    int numItems;
    double totalCost = 0, totalRevenue = 0;

    cout << "========================================" << endl;
    cout << "       DEALER SHOP PROFIT CALCULATOR    " << endl;
    cout << "========================================" << endl;

    cout << "How many items did you sell today? ";
    cin >> numItems;
    cin.ignore();

    cout << endl;

    for (int i = 1; i <= numItems; i++) {
        string name;
        double buyPrice, sellPrice, quantity;

        cout << "--- Item " << i << " ---" << endl;
        cout << "Item name         : ";
        getline(cin, name);
        cout << "Buying price (GHC): ";
        cin >> buyPrice;
        cout << "Selling price (GHC): ";
        cin >> sellPrice;
        cout << "Quantity sold     : ";
        cin >> quantity;
        cin.ignore();

        double cost    = buyPrice * quantity;
        double revenue = sellPrice * quantity;
        double profit  = revenue - cost;
        double margin  = (profit / revenue) * 100;

        cout << fixed << setprecision(2);
        cout << endl;
        cout << "  Total Cost    : GHC " << cost << endl;
        cout << "  Total Revenue : GHC " << revenue << endl;

        if (profit >= 0) {
            cout << "  Profit        : GHC " << profit << " ✓" << endl;
        } else {
            cout << "  LOSS          : GHC " << -profit << " ✗ (sold below cost!)" << endl;
        }

        cout << "  Profit Margin : " << margin << "%" << endl;
        cout << endl;

        totalCost    += cost;
        totalRevenue += revenue;
    }

    double totalProfit = totalRevenue - totalCost;
    double totalMargin = (totalProfit / totalRevenue) * 100;

    cout << "========================================" << endl;
    cout << "           DAILY SUMMARY                " << endl;
    cout << "========================================" << endl;
    cout << fixed << setprecision(2);
    cout << "Total Money Spent (Cost)  : GHC " << totalCost    << endl;
    cout << "Total Money Earned        : GHC " << totalRevenue << endl;

    if (totalProfit >= 0) {
        cout << "NET PROFIT                : GHC " << totalProfit  << endl;
        cout << "Overall Profit Margin     : "     << totalMargin  << "%" << endl;
        cout << endl;
        cout << "  >> Good job! You made a profit today." << endl;
    } else {
        cout << "NET LOSS                  : GHC " << -totalProfit << endl;
        cout << "  >> Warning: You lost money today. Review your prices." << endl;
    }

    cout << "========================================" << endl;

    return 0;
}
