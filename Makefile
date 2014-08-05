# Copyright (C) 2014 Che-Liang Chiou.

OUT ?= $(shell pwd)/out

OUT_DIRS := $(OUT) $(OUT)/extension

EXTENSION := $(OUT)/extension.zip

SRCS := $(subst extension,$(OUT)/extension,extension/manifest.json \
	$(wildcard extension/*.html) $(wildcard extension/*.js))

all: $(EXTENSION)

clean:
	rm -rf $(OUT)

$(EXTENSION): $(SRCS) | $(OUT_DIRS)
	cd $(OUT); zip -r extension.zip extension

$(SRCS) : $(OUT)/extension/% : extension/% | $(OUT_DIRS)
	cp -f $< $@

$(OUT_DIRS):
	mkdir -p $@

.PHONY: all clean
