<?php

namespace {
    if (!function_exists('svgSprite')) :
        /**
         * @return null|\SvgImagesNameSpace\SvgImagesList
         */
        function svgSprite()
        {
            return \SvgImagesNameSpace\svgSprite();
        }
    endif;

    /**
     * @return null|\SvgImagesNameSpace\SvgImagesList
     */
    function svgSpritesPackFunctionName()
    {
        return \SvgImagesNameSpace\svgSprite();
    }
}

namespace SvgImagesNameSpace {
    /**
     * @return null|SvgImagesList
     */
    function svgSprite()
    {
        static $svgImagesList = NULL;

        if ($svgImagesList === NULL)
        {
            $svgImagesList = new SvgImagesList;
        }

        return $svgImagesList;
    }

    /**
     * Class SvgImagesList
     * @package SvgImagesNameSpace
     * @property SvgImageProperties [ADDING_PROPERTIES_LIST_BELOW]
     */
    class SvgImagesList
    {
        public static $hrefBaseUrl = '[REPLACING_BASE_URL]';
        public static $imagesList = [REPLACING_IMAGES_LIST];

        public function __get($name)
        {
            if (empty(static::$imagesList[$name]))
            {
                return NULL;
            }

            if (empty(static::$imagesList[$name]['object']))
            {
                static::$imagesList[$name]['object'] = new SvgImageProperties($name);
            }

            return static::$imagesList[$name]['object'];
        }
    }


    /**
     * Class SvgImageProperties
     * @package SvgImagesNameSpace
     * @property float $width;
     * @property float $height;
     * @property string $viewBox;
     * @property string $preserveAspectRatio;
     * @property string $href;
     * @property string $class;
     * @property string $idPrefix;
     * @property string $originName;
     */
    class SvgImageProperties
    {
        protected $name = '';

        public function __construct($name)
        {
            $this->name = $name;
        }

        public function __toString()
        {
            return $this->renderSvg();
        }

        public function __get($name)
        {
            $iconData =& SvgImagesList::$imagesList[$this->name];

            if ($name === 'href' AND empty($iconData[$name]))
            {
                $iconData[$name] = $this->createAttrHref($iconData);
            }
            elseif ($name === 'class' AND empty($iconData[$name]))
            {
                $iconData[$name] = $this->createAttrClass($iconData);
            }

            return isset($iconData[$name]) ? $iconData[$name] : NULL;
        }

        /**
         * @param string|array $elementAttributes ClassName or Attributes array list
         * @param string|array $useElementAttributes ClassName or Attributes array list
         * @return string
         */
        public function __invoke($elementAttributes = [], $useElementAttributes = [])
        {
            return $this->html($elementAttributes, $useElementAttributes);
        }

        /**
         * @param string|array $elementAttributes ClassName or Attributes array list
         * @param string|array $useElementAttributes ClassName or Attributes array list
         * @return string
         */
        public function html($elementAttributes = [], $useElementAttributes = [])
        {
            return $this->renderSvg(
                $this->escAttributes($elementAttributes),
                $this->escAttributes($useElementAttributes)
            );
        }

        /**
         * @param string|array $attributes ClassName or Attributes array list
         * @return string
         */
        public function useHtml($attributes = [])
        {
            return $this->renderUse($this->escAttributes($attributes));
        }

        public static function hrefBaseUrl()
        {
            return SvgImagesList::$hrefBaseUrl;
        }

        /**
         * @param string|array $addingClass
         * @return $this
         */
        public function addClass($addingClass = '')
        {
            $addingClass = is_array($addingClass) ? $addingClass : explode(' ', $addingClass);

            $classes = array_merge(explode(' ', $this->class), $addingClass);

            $classes = array_filter($classes);

            $iconData =& SvgImagesList::$imagesList[$this->name];

            $iconData['class'] = implode(' ', $classes);

            return $this;
        }

        public function reset()
        {
            $iconData =& SvgImagesList::$imagesList[$this->name];

            $iconData['class'] = $this->createAttrClass($iconData);
        }

        /**
         * @param array|string $attributes ClassName or Attributes array list to escape
         * @return array
         */
        protected function escAttributes($attributes = [])
        {
            $attributesEscaped = [];

            if (!empty($attributes))
            {
                if (!is_array($attributes))
                {
                    $attributesEscaped['class'] = esc_attr($attributes);
                }
                else
                {
                    foreach ($attributes AS $property => $value)
                    {
                        $attributesEscaped[esc_attr(trim($property))] = esc_attr($value);
                    }
                }
            }

            return $attributesEscaped;
        }

        protected function stringifyAttributes($attributes)
        {
            $attributesList = [];

            foreach ($attributes AS $property => $value)
            {
                $attributesList[] = "$property='$value'";
            }

            return implode(' ', $attributesList);
        }

        protected function createAttrHref($iconData)
        {
            $id = "#{$iconData['idPrefix']}{$iconData['originName']}";

            $hrefBaseUrl = static::hrefBaseUrl();

            $href = "$hrefBaseUrl{$id}";

            if (function_exists('apply_filters'))
            {
                $href = apply_filters('svg_symbols_href', $href, $id, $hrefBaseUrl);
            }

            return $href;
        }

        protected function createAttrClass($iconData)
        {
            return $iconData['originName'];
        }

        protected function renderSvg(Array $elementAttributes = [], Array $useElementAttributes = [])
        {
            $defaultAttributes = [
                'class' => $this->class, 'viewBox' => $this->viewBox
            ];

            if ($this->preserveAspectRatio)
            {
                $defaultAttributes['preserveAspectRatio'] = $this->preserveAspectRatio;
            }

            $elementAttributes = array_merge($defaultAttributes, $elementAttributes);

            $attributesList = $this->stringifyAttributes($elementAttributes);

            $svgHtml = "<svg $attributesList>{$this->renderUse($useElementAttributes)}</svg>";

            $this->reset();

            return $svgHtml;
        }

        protected function renderUse(Array $elementAttributes = [])
        {
            $elementAttributes = array_merge(['xlink:href' => $this->href], $elementAttributes);

            $attributesList = $this->stringifyAttributes($elementAttributes);

            return "<use $attributesList/>";
        }
    }
}