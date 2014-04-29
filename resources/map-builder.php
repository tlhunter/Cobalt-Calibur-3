<?php
$filename = "map-source.gif";
$size = getimagesize($filename);
$width = $size[0];
$height = $size[1];

$translation = array(
    0 => 2, // Sand
    1 => 7, // Small Rock
    2 => 6, // Large Rock
    3 => 1, // Dirt
    4 => 3, // Water
    5 => 4, // Tree
    6 => 0 // Grass
);

$im = imagecreatefromgif($filename);
$data = array();

for ($x = 0; $x < $width; $x++) {
    for ($y = 0; $y < $height; $y++) {
        $rgb = imagecolorat($im, $x, $y);
        $data[$x][$y] = $translation[$rgb];
    }
}

echo json_encode($data);
