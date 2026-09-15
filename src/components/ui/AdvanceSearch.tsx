import type { LoadTxParams } from "@/app/(tabs)";
import { db } from "@/db/dbinit";
import { dbTransaction } from "@/db/schema";
import { log } from "@/lib/log";
import ReactiveKVStore from "@/lib/reactiveKV";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { count, desc } from "drizzle-orm";
import { useFocusEffect } from "expo-router";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Dimensions, ScrollView, View } from "react-native";
import {
  Badge,
  Button,
  Chip,
  HelperText,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

type AdvanceSearch = {
  visible: boolean;
  defaultData: {
    timeTo: Date;
    timeFrom: Date;
  };
  normalSearchQuery: string;
  onSearch: (query: LoadTxParams) => Promise<void>;
};

export type AdvanceSearchRef = {
  search: (query: string, isLoadMore?: boolean) => void;
  advanceSearch: (query: LoadTxParams) => void;
};

export const AdvanceSearch = forwardRef<AdvanceSearchRef, AdvanceSearch>(
  ({ visible, defaultData, onSearch, normalSearchQuery }, ref) => {
    // const timeRangeStartingPoint = new Date(defaultData.endTime);
    // timeRangeStartingPoint.setMonth(timeRangeStartingPoint.getMonth() - 1);

    const appTheme = useTheme();
    const dim = Dimensions.get("window");
    const tags = ReactiveKVStore.useReactiveKVStore((s) => s.tags);

    const [isLoading, setIsLoading] = useState(false);
    const [startingTime, setStartingTime] = useState(defaultData.timeFrom);
    const [endingTime, setEndingTime] = useState(defaultData.timeTo);
    const [amountRange, setAmountRange] = useState({ min: "", max: "" });

    const [toFromList, setToFromList] = useState<
      { toFrom: string; count: number }[]
    >([]);
    const [selectedTagIndex, setSelectedTagIndex] = useState<number[]>([]);
    const [selectedToFromIndex, setSelectedToFromIndex] = useState<number[]>(
      [],
    );
    const [amountMinErrMsg, setAmountMinErrMsg] = useState("");
    const [amountMaxErrMsg, setAmountMaxErrMsg] = useState("");

    const loadToAndFrom = useCallback(async () => {
      const toFromList = await db
        .select({
          toFrom: dbTransaction.toFrom,
          count: count(dbTransaction.id),
        })
        .from(dbTransaction)
        .groupBy(dbTransaction.toFrom)
        .orderBy(desc(count(dbTransaction.id)));
      setToFromList(toFromList);
    }, []);

    const fullDateTimeFormatter = useMemo(
      () =>
        Intl.DateTimeFormat("en", {
          day: "2-digit",
          year: "numeric",
          month: "short",
          minute: "2-digit",
          hour12: true,
          hour: "2-digit",
        }),
      [],
    );

    useFocusEffect(
      useCallback(() => {
        loadToAndFrom();
      }, []),
    );

    const search = (query: string, isLoadMore?: boolean) => {
      if (visible) {
        const obj = {
          overrideSearch: query,
          timeRange: { start: startingTime, end: endingTime },
          tags: selectedTagIndex.map((index) => tags[index]),
          toFrom: selectedToFromIndex.map((index) => toFromList[index].toFrom),
          amountRange: {
            min: parseFloat(amountRange.min) || undefined,
            max: parseFloat(amountRange.max) || undefined,
          },
          isLoadMore,
        };
        console.log("Advance search", query, obj);
        onSearch(obj);
      } else {
        console.log("Search", query, isLoadMore);
        onSearch({
          overrideSearch: query,
          isLoadMore,
        });
      }
    };

    useImperativeHandle(ref, () => ({
      search: (query: string, isLoadMore?: boolean) => {
        search(query, isLoadMore);
      },
      advanceSearch: (query: LoadTxParams) => {
        onSearch({
          ...query,
        });
      },
    }));

    console.log({ amountMaxErrMsg, amountMinErrMsg });

    if (visible) {
      return (
        <Animated.View
          entering={FadeIn.duration(250)}
          exiting={FadeOut.duration(200)}
          style={{
            padding: 10,
            gap: 10,
            maxHeight: dim.height - dim.height / 3,
          }}
        >
          <ScrollView>
            <View style={{ gap: 10 }}>
              <Text
                style={{ fontSize: 16, fontWeight: "600", marginBottom: 5 }}
              >
                Time range:
              </Text>
              <View style={{ gap: 10 }}>
                <Button
                  mode="elevated"
                  onPress={() =>
                    DateTimePickerAndroid.open({
                      value: startingTime,
                      onValueChange: (_, date) => setStartingTime(date),
                      maximumDate: endingTime,
                    })
                  }
                >
                  Start: {fullDateTimeFormatter.format(startingTime)}
                </Button>
                {/*<IconButton icon="arrow-right-thin" />*/}
                <Button
                  mode="elevated"
                  onPress={() =>
                    DateTimePickerAndroid.open({
                      value: endingTime,
                      onValueChange: (_, date) => setEndingTime(date),
                      minimumDate: startingTime,
                    })
                  }
                >
                  End: {fullDateTimeFormatter.format(endingTime)}
                </Button>
              </View>
              <Text
                style={{ fontSize: 16, fontWeight: "600", marginBottom: 5 }}
              >
                Tags:
              </Text>
              {/*<ScrollView horizontal>*/}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  flexWrap: "wrap",
                }}
              >
                {tags.map((tag, index) => (
                  <Chip
                    key={tag}
                    selected={selectedTagIndex.includes(index)}
                    onPress={() => {
                      if (selectedTagIndex.includes(index)) {
                        setSelectedTagIndex(
                          selectedTagIndex.filter((i) => i !== index),
                        );
                      } else {
                        setSelectedTagIndex([...selectedTagIndex, index]);
                      }
                    }}
                  >
                    {tag}
                  </Chip>
                ))}
              </View>
              {/*</ScrollView>*/}
              <Text
                style={{ fontSize: 16, fontWeight: "600", marginBottom: 5 }}
              >
                To/From:
              </Text>
              {/*<ScrollView horizontal>*/}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  flexWrap: "wrap",
                }}
              >
                {toFromList.map((item, index) => (
                  <Chip
                    mode="outlined"
                    key={item.toFrom}
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    selected={selectedToFromIndex.includes(index)}
                    onPress={() => {
                      if (selectedToFromIndex.includes(index)) {
                        setSelectedToFromIndex(
                          selectedToFromIndex.filter((i) => i !== index),
                        );
                      } else {
                        setSelectedToFromIndex([...selectedToFromIndex, index]);
                      }
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Text>{item.toFrom}</Text>

                      <Text
                        style={{
                          backgroundColor: appTheme.colors.surfaceVariant,
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          textAlign: "center",
                          elevation: 3,
                          shadowColor: appTheme.colors.shadow,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                        }}
                      >
                        {item.count}
                      </Text>
                    </View>
                  </Chip>
                ))}
              </View>
              {/*</ScrollView>*/}
              <View>
                <Text
                  style={{ fontSize: 16, fontWeight: "600", marginBottom: 5 }}
                >
                  Amount range:
                </Text>
                <View style={{ gap: 5 }}>
                  <TextInput
                    error={!!amountMinErrMsg}
                    placeholder="Any (min)"
                    mode="outlined"
                    value={amountRange.min.toString()}
                    onChangeText={(text) => {
                      const min = text.replace(/[^0-9]/g, "").trim();

                      if (
                        amountRange.max &&
                        min &&
                        parseInt(amountRange.max) < parseInt(min)
                      ) {
                        setAmountMinErrMsg(
                          "Max amount must be greater than min amount",
                        );
                      } else {
                        setAmountMinErrMsg("");
                      }
                      setAmountRange({
                        ...amountRange,
                        min,
                      });
                    }}
                    right={<TextInput.Affix text="Min" />}
                  />
                  {amountMinErrMsg ? (
                    <HelperText type="error">{amountMinErrMsg}</HelperText>
                  ) : null}
                  {/*<IconButton icon="arrow-right-thin" />*/}
                  <TextInput
                    error={!!amountMaxErrMsg}
                    placeholder="Any (max)"
                    mode="outlined"
                    value={amountRange.max}
                    onChangeText={(text) => {
                      const max = text.replace(/[^0-9]/g, "").trim();

                      if (
                        amountRange.min &&
                        max &&
                        parseInt(max) < parseInt(amountRange.min)
                      ) {
                        setAmountMaxErrMsg(
                          "Min amount must be less than max amount",
                        );
                      } else {
                        setAmountMaxErrMsg("");
                      }
                      console.log(
                        max,
                        amountRange,
                        parseInt(max) < parseInt(amountRange.min),
                        parseInt(max),
                        parseInt(amountRange.min),
                      );
                      setAmountRange({
                        ...amountRange,
                        max,
                      });
                    }}
                    right={<TextInput.Affix text="Max" />}
                  />
                  {amountMaxErrMsg ? (
                    <HelperText type="error">{amountMaxErrMsg}</HelperText>
                  ) : null}
                </View>
              </View>
              <Button
                mode="contained"
                loading={isLoading}
                onPress={async () => {
                  try {
                    setIsLoading(true);
                    search(normalSearchQuery);
                  } catch (error) {
                    log.error(error);
                  } finally {
                    setIsLoading(false);
                  }
                }}
                icon={"magnify"}
              >
                Search
              </Button>
            </View>
          </ScrollView>
        </Animated.View>
      );
    } else {
      return null;
    }
  },
);
