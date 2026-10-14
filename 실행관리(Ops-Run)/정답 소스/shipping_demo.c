#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

__attribute__((noinline, used))
int shipping_fee(int amount, int member) {
    if (amount >= 50000 || (member != 0 && amount >= 30000)) {
        return 0;
    }
    return 3500;
}

int main(int argc, char **argv) {
    if (argc != 3) {
        fprintf(stderr, "사용법: shipping-demo 주문금액 회원여부(0 또는 1)\n");
        return 2;
    }
    errno = 0;
    char *end = NULL;
    long parsed = strtol(argv[1], &end, 10);
    if (errno != 0 || end == argv[1] || *end != '\0' || parsed < 0 ||
        parsed > 100000000 ||
        (strcmp(argv[2], "0") != 0 && strcmp(argv[2], "1") != 0)) {
        fprintf(stderr, "주문금액은 0~100000000, 회원여부는 0 또는 1이어야 함\n");
        return 2;
    }
    int amount = (int)parsed;
    int member = argv[2][0] == '1';
    int fee = shipping_fee(amount, member);
    printf("{\"amount\":%d,\"member\":%d,\"shipping_fee\":%d,\"total\":%d}\n",
           amount, member, fee, amount + fee);
    return 0;
}
