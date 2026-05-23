def extract_lab_features(rgb_sample: tuple[int, int, int]) -> dict[str, float]:
    red, green, blue = rgb_sample
    lightness = round((max(rgb_sample) / 255) * 100, 2)
    red_green_axis = round((red - green) / 255 * 30, 2)
    yellow_blue_axis = round(((red + green) / 2 - blue) / 255 * 30, 2)

    return {"L": lightness, "a": red_green_axis, "b": yellow_blue_axis}
