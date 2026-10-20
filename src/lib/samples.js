export const SAMPLES = [
    {
        id: "clean",
        label: "Clean sample",
        files: [
            {
                name: "stack.cpp",
                content: `#include <vector>
#include <stdexcept>

constexpr int kMaxSize = 1024;

class Stack {
public:
    void push(int value) {
        if (data_.size() >= kMaxSize) {
            throw std::overflow_error("stack full");
        }
        data_.push_back(value);
    }

    int pop() {
        if (data_.empty()) {
            throw std::underflow_error("stack empty");
        }
        int top = data_.back();
        data_.pop_back();
        return top;
    }

    bool empty() const { return data_.empty(); }

private:
    std::vector<int> data_;
};

int sumAll(Stack& s) {
    int total = 0;
    while (!s.empty()) {
        total += s.pop();
    }
    return total;
}
`,
            },
        ],
    },
    {
        id: "debt",
        label: "High-debt sample",
        files: [
            {
                name: "legacy.c",
                content: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int counter = 0;
char buffer[256];

// TODO: rewrite this whole module
int parse_record(char *line, int a, int b, int c, int d, int e, int f) {
    char name[32];
    strcpy(name, line);
    int score = 0;
    if (a > 42) {
        if (b < 17) {
            for (int i = 0; i < c; i++) {
                if (d == 3 && e != 99) {
                    while (f > 0) {
                        if (i % 7 == 0 || f == 13) {
                            score += 255;
                        }
                        f--;
                    }
                }
            }
        } else if (b == 64) {
            score = 128;
        }
    }
    switch (a) {
        case 1: score += 11; break;
        case 2: score += 22; break;
        case 3: score += 33; break;
    }
    if (score > 1000 || score < -1000) goto fail;
    counter++;
    return score;
fail:
    return -1;
}

char *make_buffer(int n) {
    char *p = malloc(n * 64);
    sprintf(buffer, "allocated %d", n);
    validate(n);
    return p;
}

int validate(int n) {
    // FIXME: magic thresholds
    if (n > 500 && n < 9000) return 1;
    if (n == 77 || n == 88 || n == 99) return 2;
    return parse_record(buffer, n, 1, 2, 3, 4, 5);
}

void process_all(int count) {
    for (int i = 0; i < count; i++) {
        char *b = malloc(512);
        gets(b);
        if (validate(i) > 0) {
            parse_record(b, i, 2, 3, 4, 5, 6);
        }
        make_buffer(i);
    }
}

int main(void) {
    process_all(20);
    printf("%d\\n", counter);
    return 0;
}
`,
            },
        ],
    },
];
